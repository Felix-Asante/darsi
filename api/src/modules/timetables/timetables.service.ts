import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { daysBetween } from '../../common/dates/calendar-date.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import {
  AcademicsService,
  type ClassView,
} from '../academics/academics.service.js';
import { CalendarService } from '../calendar/calendar.service.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import type {
  BellPeriodDto,
  BellScheduleDto,
  TimetableSlotDto,
} from './dto/timetables.dto.js';
import { BellPeriod } from './entities/bell-period.entity.js';
import { BellSchedule } from './entities/bell-schedule.entity.js';
import { TimetableSlot } from './entities/timetable-slot.entity.js';
import { cycleDays, cycleLength, type Rotation } from './rotation.js';

const MAX_RANGE_DAYS = 42;
const hhmm = (time: string) => time.slice(0, 5);

export interface PeriodView {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
}

export interface ScheduleView {
  id: string;
  divisionId: string | null;
  name: string;
  rotationKind: BellSchedule['rotationKind'];
  rotationLength: number;
  weekdays: number[];
  cycleLength: number;
  periods: PeriodView[];
}

export interface SlotView {
  id: string;
  classId: string;
  cycleDay: number;
  room: string | null;
  teacherUserId: string | null;
  period: PeriodView;
}

/** One lesson on one date. */
export interface LessonView {
  date: string;
  cycleDay: number;
  slotId: string;
  room: string | null;
  period: PeriodView;
  class: Pick<ClassView, 'id' | 'code' | 'name' | 'subject'>;
  teachers: string[];
}

const rotationOf = (schedule: BellSchedule): Rotation =>
  schedule.rotationKind === 'weekly'
    ? { kind: 'weekly', weeks: schedule.rotationLength }
    : { kind: 'cycle', days: schedule.rotationLength };

const periodView = (period: BellPeriod): PeriodView => ({
  id: period.id,
  name: period.name,
  startsAt: hhmm(period.startsAt),
  endsAt: hhmm(period.endsAt),
  sortOrder: period.sortOrder,
});

@Injectable()
export class TimetablesService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly calendar: CalendarService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Bell schedules and periods ──────────────────────────────────────

  async listSchedules(): Promise<ScheduleView[]> {
    const [schedules, periods] = await Promise.all([
      this.tx.find(BellSchedule, { order: { name: 'ASC' } }),
      this.tx.find(BellPeriod, {
        order: { sortOrder: 'ASC', startsAt: 'ASC' },
      }),
    ]);
    return schedules.map((schedule) => this.scheduleView(schedule, periods));
  }

  async createSchedule(dto: BellScheduleDto): Promise<ScheduleView> {
    if (dto.divisionId) await this.academics.findDivision(dto.divisionId);
    const schedule = await this.tx.save(
      this.tx.create(BellSchedule, {
        divisionId: dto.divisionId ?? null,
        name: dto.name,
        rotationKind: dto.rotationKind,
        rotationLength: dto.rotationLength,
        weekdays: dedupe(dto.weekdays ?? [1, 2, 3, 4, 5]),
      }),
    );
    return this.scheduleView(schedule, []);
  }

  async updateSchedule(
    id: string,
    dto: BellScheduleDto,
  ): Promise<ScheduleView> {
    const schedule = await this.findSchedule(id);
    if (dto.divisionId) await this.academics.findDivision(dto.divisionId);
    Object.assign(schedule, {
      divisionId: dto.divisionId ?? null,
      name: dto.name,
      rotationKind: dto.rotationKind,
      rotationLength: dto.rotationLength,
      weekdays: dedupe(dto.weekdays ?? schedule.weekdays),
    });
    await this.tx.save(schedule);
    // Slots beyond a shortened rotation would never be shown, so they go.
    await this.tx
      .createQueryBuilder()
      .delete()
      .from(TimetableSlot)
      .where(
        'period_id IN (SELECT id FROM bell_periods WHERE bell_schedule_id = :id)',
        { id },
      )
      .andWhere('cycle_day > :length', {
        length: cycleLength(rotationOf(schedule), schedule.weekdays),
      })
      .execute();
    return this.scheduleView(
      schedule,
      await this.tx.findBy(BellPeriod, { bellScheduleId: id }),
    );
  }

  async deleteSchedule(id: string): Promise<void> {
    const result = await this.tx.delete(BellSchedule, { id });
    if (!result.affected) throw new NotFoundException();
  }

  async createPeriod(
    scheduleId: string,
    dto: BellPeriodDto,
  ): Promise<PeriodView> {
    await this.findSchedule(scheduleId);
    assertTimes(dto);
    const sortOrder =
      dto.sortOrder ??
      (await this.tx.countBy(BellPeriod, { bellScheduleId: scheduleId }));
    return periodView(
      await this.tx.save(
        this.tx.create(BellPeriod, {
          bellScheduleId: scheduleId,
          name: dto.name,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          sortOrder,
        }),
      ),
    );
  }

  async updatePeriod(id: string, dto: BellPeriodDto): Promise<PeriodView> {
    const period = await this.tx.findOneBy(BellPeriod, { id });
    if (!period) throw new NotFoundException();
    assertTimes(dto);
    return periodView(
      await this.tx.save(
        Object.assign(period, dto, {
          sortOrder: dto.sortOrder ?? period.sortOrder,
        }),
      ),
    );
  }

  async deletePeriod(id: string): Promise<void> {
    const result = await this.tx.delete(BellPeriod, { id });
    if (!result.affected) throw new NotFoundException();
  }

  // ── Class slots ─────────────────────────────────────────────────────

  /** The class's slots and the schedule they fit in (null until one is set up). */
  async classTimetable(
    classId: string,
  ): Promise<{ schedule: ScheduleView | null; slots: SlotView[] }> {
    await this.policy.assertClassAccess(classId);
    const schoolClass = (await this.academics.findClassesByIds([classId]))[0];
    if (!schoolClass) throw new NotFoundException();
    const schedule = await this.scheduleForClass(schoolClass);
    const slots = await this.tx.find(TimetableSlot, {
      where: { classId },
      order: { cycleDay: 'ASC' },
    });
    const periods = schedule?.periods ?? [];
    return {
      schedule,
      slots: slots
        .map((slot) => ({
          slot,
          period: periods.find((period) => period.id === slot.periodId),
        }))
        .filter(
          (entry): entry is { slot: TimetableSlot; period: PeriodView } =>
            entry.period !== undefined,
        )
        .sort(
          (a, b) =>
            a.slot.cycleDay - b.slot.cycleDay ||
            a.period.startsAt.localeCompare(b.period.startsAt),
        )
        .map(({ slot, period }) => ({
          id: slot.id,
          classId,
          cycleDay: slot.cycleDay,
          room: slot.room,
          teacherUserId: slot.teacherUserId,
          period,
        })),
    };
  }

  async createSlot(classId: string, dto: TimetableSlotDto): Promise<SlotView> {
    const { schedule } = await this.classTimetable(classId);
    const period = schedule?.periods.find(
      (candidate) => candidate.id === dto.periodId,
    );
    if (!schedule || !period) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'periodId', codes: ['notFound'] }],
      );
    }
    if (dto.cycleDay > schedule.cycleLength) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'cycleDay', codes: ['max'] }],
      );
    }
    if (dto.teacherUserId)
      await this.academics.assertMembers([dto.teacherUserId]);
    const slot = await this.tx.save(
      this.tx.create(TimetableSlot, {
        classId,
        periodId: period.id,
        cycleDay: dto.cycleDay,
        room: dto.room ?? null,
        teacherUserId: dto.teacherUserId ?? null,
      }),
    );
    return {
      id: slot.id,
      classId,
      cycleDay: slot.cycleDay,
      room: slot.room,
      teacherUserId: slot.teacherUserId,
      period,
    };
  }

  /** For imports: places a class in a period by the period's name; repeating it changes only the room. */
  async upsertSlot(
    classId: string,
    periodName: string,
    cycleDay: number,
    room: string | null,
  ): Promise<'periodNotFound' | 'dayOutOfRange' | null> {
    const schoolClass = (await this.academics.findClassesByIds([classId]))[0];
    const schedule = schoolClass
      ? await this.scheduleForClass(schoolClass)
      : null;
    const period = schedule?.periods.find(
      (candidate) => candidate.name.toLowerCase() === periodName.toLowerCase(),
    );
    if (!schedule || !period) return 'periodNotFound';
    if (cycleDay < 1 || cycleDay > schedule.cycleLength) return 'dayOutOfRange';
    await this.tx
      .createQueryBuilder()
      .insert()
      .into(TimetableSlot)
      .values({ id: uuidv7(), classId, periodId: period.id, cycleDay, room })
      .orUpdate(['room'], ['class_id', 'period_id', 'cycle_day'])
      .execute();
    return null;
  }

  async deleteSlot(classId: string, slotId: string): Promise<void> {
    const result = await this.tx.delete(TimetableSlot, { id: slotId, classId });
    if (!result.affected) throw new NotFoundException();
  }

  // ── Timetables ──────────────────────────────────────────────────────

  /** The signed-in user's lessons: the classes they teach or support, or their own as a student. */
  async mine(from: string, to: string): Promise<LessonView[]> {
    const userId = this.context.requireUserId();
    const [staffed, covering, studentId] = await Promise.all([
      this.policy.classIdsForUser(userId),
      this.tx.findBy(TimetableSlot, { teacherUserId: userId }),
      this.people.studentIdForUser(userId),
    ]);
    const enrolled = studentId
      ? await this.people.currentClassIds(studentId)
      : [];
    return this.lessons(
      [...staffed, ...covering.map((slot) => slot.classId), ...enrolled],
      from,
      to,
      userId,
    );
  }

  async forStudent(
    studentId: string,
    from: string,
    to: string,
  ): Promise<LessonView[]> {
    await this.policy.assertStudentAccess(studentId);
    return this.lessons(await this.people.currentClassIds(studentId), from, to);
  }

  async forClass(
    classId: string,
    from: string,
    to: string,
  ): Promise<LessonView[]> {
    await this.policy.assertClassAccess(classId);
    return this.lessons([classId], from, to);
  }

  /**
   * Places each class's slots on real dates: the rotation decides which cycle
   * day a date is, and the class's holidays and closures remove the day (TT-5).
   */
  private async lessons(
    classIds: string[],
    from: string,
    to: string,
    viewerId?: string,
  ): Promise<LessonView[]> {
    const days = daysBetween(from, to);
    if (days < 0 || days > MAX_RANGE_DAYS) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'to', codes: ['range'] }],
      );
    }
    const classes = await this.academics.findClassesByIds([
      ...new Set(classIds),
    ]);
    if (classes.length === 0) return [];

    const [slots, schedules, periods, levels] = await Promise.all([
      this.tx.findBy(TimetableSlot, {
        classId: In(classes.map((schoolClass) => schoolClass.id)),
      }),
      this.tx.find(BellSchedule),
      this.tx.find(BellPeriod),
      this.academics.gradeLevelsByIds(
        classes.map((schoolClass) => schoolClass.gradeLevel?.id ?? null),
      ),
    ]);

    const lessons: LessonView[] = [];
    for (const schoolClass of classes) {
      const divisionId =
        levels.find((level) => level.id === schoolClass.gradeLevel?.id)
          ?.divisionId ?? null;
      const schedule =
        schedules.find(
          (candidate) => divisionId && candidate.divisionId === divisionId,
        ) ?? schedules.find((candidate) => candidate.divisionId === null);
      const classSlots = slots.filter(
        (slot) => slot.classId === schoolClass.id,
      );
      if (!schedule || classSlots.length === 0) continue;

      const year = await this.academics.findYear(schoolClass.academicYearId);
      const end = to < year.endsOn ? to : year.endsOn;
      if (end < from) continue;
      const daysOff = await this.calendar.daysOff(from, end, {
        classId: schoolClass.id,
        gradeLevelId: schoolClass.gradeLevel?.id ?? null,
        divisionId,
      });
      const cycle = cycleDays(from, end, rotationOf(schedule), {
        anchor: year.startsOn,
        weekdays: schedule.weekdays,
        isDayOff: (date) => daysOff.has(date),
      });
      const teachers = schoolClass.staff.filter(
        (member) => member.role === 'teacher',
      );

      for (const [date, cycleDay] of cycle) {
        if (cycleDay === null) continue;
        for (const slot of classSlots.filter(
          (candidate) => candidate.cycleDay === cycleDay,
        )) {
          const period = periods.find(
            (candidate) => candidate.id === slot.periodId,
          );
          if (!period) continue;
          // The class's teacher isn't teaching a slot someone else covers.
          const coveredForMe =
            viewerId !== undefined &&
            slot.teacherUserId !== null &&
            slot.teacherUserId !== viewerId &&
            teachers.some((member) => member.userId === viewerId);
          if (coveredForMe) continue;
          lessons.push({
            date,
            cycleDay,
            slotId: slot.id,
            room: slot.room,
            period: periodView(period),
            class: {
              id: schoolClass.id,
              code: schoolClass.code,
              name: schoolClass.name,
              subject: schoolClass.subject,
            },
            teachers: slot.teacherUserId
              ? schoolClass.staff
                  .filter((member) => member.userId === slot.teacherUserId)
                  .map((member) => member.name)
              : teachers.map((member) => member.name),
          });
        }
      }
    }
    return lessons.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.period.startsAt.localeCompare(b.period.startsAt),
    );
  }

  private async scheduleForClass(
    schoolClass: ClassView,
  ): Promise<ScheduleView | null> {
    const level = schoolClass.gradeLevel
      ? await this.academics.findGradeLevel(schoolClass.gradeLevel.id)
      : null;
    const schedule =
      (level
        ? await this.tx.findOneBy(BellSchedule, {
            divisionId: level.divisionId,
          })
        : null) ??
      (await this.tx.findOneBy(BellSchedule, { divisionId: IsNull() }));
    if (!schedule) return null;
    return this.scheduleView(
      schedule,
      await this.tx.find(BellPeriod, {
        where: { bellScheduleId: schedule.id },
        order: { sortOrder: 'ASC' },
      }),
    );
  }

  private async findSchedule(id: string): Promise<BellSchedule> {
    const schedule = await this.tx.findOneBy(BellSchedule, { id });
    if (!schedule) throw new NotFoundException();
    return schedule;
  }

  private scheduleView(
    schedule: BellSchedule,
    periods: BellPeriod[],
  ): ScheduleView {
    return {
      id: schedule.id,
      divisionId: schedule.divisionId,
      name: schedule.name,
      rotationKind: schedule.rotationKind,
      rotationLength: schedule.rotationLength,
      weekdays: schedule.weekdays,
      cycleLength: cycleLength(rotationOf(schedule), schedule.weekdays),
      periods: periods
        .filter((period) => period.bellScheduleId === schedule.id)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.startsAt.localeCompare(b.startsAt),
        )
        .map(periodView),
    };
  }
}

const dedupe = (weekdays: number[]) => [...new Set(weekdays)];

function assertTimes({ startsAt, endsAt }: BellPeriodDto) {
  if (endsAt <= startsAt) {
    throw new ProblemException(
      HttpStatus.BAD_REQUEST,
      'validation_failed',
      undefined,
      [{ field: 'endsAt', codes: ['afterStart'] }],
    );
  }
}
