import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Queue } from 'bullmq';
import { Between, In, IsNull } from 'typeorm';
import { daysBetween } from '../../common/dates/calendar-date.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { CalendarService } from '../calendar/calendar.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { TimetablesService } from '../timetables/timetables.service.js';
import type {
  AttendanceSettingsDto,
  AttendanceStatusDto,
  ReportQueryDto,
  TakeAttendanceDto,
} from './dto/attendance.dto.js';
import {
  AbsenceNote,
  AttendanceRecord,
  AttendanceSession,
  AttendanceSettings,
  AttendanceStatus,
  COUNTS_AS,
  type CountsAs,
} from './entities/attendance.entities.js';
import { summarize, toCsv } from './summary.js';

export const ATTENDANCE_QUEUE = 'attendance';

export interface AbsenceCheckJob {
  schoolId: string;
  sessionId: string;
}

export interface StatusView {
  code: string;
  label: string | null;
  countsAs: CountsAs;
}

/** Built in, translated by the app. Schools add their own on top. */
const BUILT_IN: StatusView[] = COUNTS_AS.map((code) => ({
  code,
  label: null,
  countsAs: code,
}));
const MAX_REPORT_DAYS = 400;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly calendar: CalendarService,
    private readonly timetables: TimetablesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
    @InjectQueue(ATTENDANCE_QUEUE)
    private readonly queue: Queue<AbsenceCheckJob>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Settings and statuses ───────────────────────────────────────────

  async settings(): Promise<
    Pick<AttendanceSettings, 'mode' | 'notifyAfterMinutes'>
  > {
    const settings = await this.tx.findOneBy(AttendanceSettings, {});
    return {
      mode: settings?.mode ?? 'daily',
      notifyAfterMinutes: settings?.notifyAfterMinutes ?? 60,
    };
  }

  async saveSettings(dto: AttendanceSettingsDto) {
    const settings =
      (await this.tx.findOneBy(AttendanceSettings, {})) ??
      this.tx.create(AttendanceSettings, {});
    await this.tx.save(
      Object.assign(settings, {
        mode: dto.mode,
        notifyAfterMinutes: dto.notifyAfterMinutes,
      }),
    );
    return this.settings();
  }

  async statuses(): Promise<StatusView[]> {
    const custom = await this.tx.find(AttendanceStatus, {
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
    return [
      ...BUILT_IN,
      ...custom.map(({ code, label, countsAs }) => ({ code, label, countsAs })),
    ];
  }

  async createStatus(dto: AttendanceStatusDto): Promise<StatusView> {
    if (BUILT_IN.some((status) => status.code === dto.code)) {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'already_exists',
        undefined,
        [{ field: 'code', codes: ['alreadyExists'] }],
      );
    }
    const sortOrder = await this.tx.count(AttendanceStatus);
    const status = await this.tx.save(
      this.tx.create(AttendanceStatus, { ...pickStatus(dto), sortOrder }),
    );
    return {
      code: status.code,
      label: status.label,
      countsAs: status.countsAs,
    };
  }

  async deleteStatus(code: string): Promise<void> {
    const result = await this.tx.delete(AttendanceStatus, { code });
    if (!result.affected) throw new NotFoundException();
  }

  // ── Taking attendance ───────────────────────────────────────────────

  /** The class list for a day (or period) with what was recorded, everyone present by default (ATT-3). */
  async session(classId: string, date: string, periodId?: string | null) {
    await this.policy.assertClassAccess(classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const [settings, statuses, students, today, dayOff] = await Promise.all([
      this.settings(),
      this.statuses(),
      this.people.roster(classId),
      this.clock.today(),
      this.isDayOff(classId, date),
    ]);
    const session = await this.tx.findOneBy(AttendanceSession, {
      classId,
      date,
      periodId: periodId ?? IsNull(),
    });
    const records = session
      ? await this.tx.findBy(AttendanceRecord, { sessionId: session.id })
      : [];
    const notes = await this.tx.findBy(AbsenceNote, {
      studentId: In(students.map((student) => student.id)),
      date,
    });

    return {
      mode: settings.mode,
      date,
      periodId: periodId ?? null,
      dayOff,
      closed: date < today,
      taken: session ? { at: session.takenAt, by: session.takenBy } : null,
      statuses,
      students: students.map((student) => {
        const record = records.find(
          (candidate) => candidate.studentId === student.id,
        );
        const note = notes.find(
          (candidate) => candidate.studentId === student.id,
        );
        return {
          student,
          status: record?.status ?? 'present',
          reason: record?.reason ?? note?.reason ?? null,
          reasonSource: record?.reasonSource ?? (note ? 'guardian' : null),
        };
      }),
    };
  }

  async take(classId: string, dto: TakeAttendanceDto) {
    await this.policy.assertClassAccess(classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const periodId = dto.periodId ?? null;
    const [settings, statuses, roster, today] = await Promise.all([
      this.settings(),
      this.statuses(),
      this.people.roster(classId),
      this.clock.today(),
    ]);

    if (dto.date > today)
      throw problem(HttpStatus.BAD_REQUEST, 'future_date', 'date');
    if (settings.mode === 'daily' && periodId)
      throw problem(HttpStatus.BAD_REQUEST, 'daily_attendance', 'periodId');
    if (settings.mode === 'period' && !periodId)
      throw problem(HttpStatus.BAD_REQUEST, 'period_required', 'periodId');
    if (await this.isDayOff(classId, dto.date)) {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'no_school',
        'Attendance is not taken on holidays and closures',
      );
    }
    if (periodId) {
      const lessons = await this.timetables.forClass(
        classId,
        dto.date,
        dto.date,
      );
      if (!lessons.some((lesson) => lesson.period.id === periodId)) {
        throw problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'not_scheduled',
          'periodId',
        );
      }
    }
    const enrolled = new Set(roster.map((student) => student.id));
    const codes = new Set(statuses.map((status) => status.code));
    dto.records.forEach((record, index) => {
      if (!enrolled.has(record.studentId))
        throw problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'validation_failed',
          `records.${index}.studentId`,
          'notEnrolled',
        );
      if (!codes.has(record.status))
        throw problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'validation_failed',
          `records.${index}.status`,
          'isIn',
        );
    });

    const userId = this.context.requireUserId();
    const existing = await this.tx.findOneBy(AttendanceSession, {
      classId,
      date: dto.date,
      periodId: periodId ?? IsNull(),
    });
    const session = await this.tx.save(
      Object.assign(
        existing ??
          this.tx.create(AttendanceSession, {
            classId,
            date: dto.date,
            periodId,
          }),
        {
          takenBy: userId,
          takenAt: new Date(),
        },
      ),
    );
    const before = new Map(
      (await this.tx.findBy(AttendanceRecord, { sessionId: session.id })).map(
        (record) => [record.studentId, record] as const,
      ),
    );
    const given = new Map(
      dto.records.map((record) => [record.studentId, record] as const),
    );
    const closed = dto.date < today;

    for (const student of roster) {
      const entry = given.get(student.id);
      const previous = before.get(student.id);
      const status = entry?.status ?? 'present';
      const reason =
        entry?.reason?.trim() || (entry ? null : (previous?.reason ?? null));
      const record =
        previous ??
        this.tx.create(AttendanceRecord, {
          sessionId: session.id,
          studentId: student.id,
          notifiedAt: null,
        });
      const changed =
        previous && (previous.status !== status || previous.reason !== reason);
      const snapshot = previous && {
        status: previous.status,
        reason: previous.reason,
      };
      Object.assign(record, {
        status,
        reason,
        reasonSource: reason
          ? entry?.reason
            ? 'staff'
            : record.reasonSource
          : null,
      });
      await this.tx.save(record);
      // Edits after the day closes are audited (ATT-8).
      if (closed && changed) {
        await this.audit.record({
          action: 'attendance.changed',
          entityType: 'attendance_record',
          entityId: record.id,
          before: snapshot,
          after: { status, reason },
        });
      }
    }
    await this.audit.record({
      action: existing ? 'attendance.retaken' : 'attendance.taken',
      entityType: 'attendance_session',
      entityId: session.id,
      after: {
        classId,
        date: dto.date,
        periodId,
        absences: dto.records.filter((record) => record.status !== 'present')
          .length,
      },
    });

    await this.queue.add(
      'absence-check',
      { schoolId: this.context.requireSchoolId(), sessionId: session.id },
      {
        delay: settings.notifyAfterMinutes * 60_000,
        jobId: `absence-${session.id}-${session.takenAt.getTime()}`,
      },
    );
    return this.session(classId, dto.date, periodId);
  }

  /**
   * Runs in the worker after the school's delay: guardians hear about each
   * absence still unexplained, once, in the language they chose (ATT-5).
   */
  async notifyUnexplained({
    schoolId,
    sessionId,
  }: AbsenceCheckJob): Promise<number> {
    return this.transactions.runInSchool(schoolId, async () => {
      const session = await this.tx.findOneBy(AttendanceSession, {
        id: sessionId,
      });
      if (!session) return 0;
      const absentCodes = (await this.statuses())
        .filter((status) => status.countsAs === 'absent')
        .map((status) => status.code);
      const records = await this.tx.findBy(AttendanceRecord, {
        sessionId,
        status: In(absentCodes),
        reason: IsNull(),
        notifiedAt: IsNull(),
      });
      const notes = await this.tx.findBy(AbsenceNote, {
        studentId: In(records.map((record) => record.studentId)),
        date: session.date,
      });
      const unexplained = records.filter(
        (record) => !notes.some((note) => note.studentId === record.studentId),
      );
      if (unexplained.length === 0) return 0;

      const [schoolClass] = await this.academics.findClassesByIds([
        session.classId,
      ]);
      const students = await this.people.studentsByIds(
        unexplained.map((record) => record.studentId),
      );
      const guardians = await this.people.guardianAccounts(
        unexplained.map((record) => record.studentId),
      );
      for (const record of unexplained) {
        const student = students.find(
          (candidate) => candidate.id === record.studentId,
        );
        const recipients = guardians.filter(
          (guardian) => guardian.studentId === record.studentId,
        );
        if (student && recipients.length > 0) {
          const params = {
            student: `${student.preferredName ?? student.firstName} ${student.lastName}`,
            status: 'absent' as const,
            className: schoolClass?.name ?? '',
            date: session.date,
          };
          await this.notifications.deliver({
            userIds: recipients.map((guardian) => guardian.userId),
            type: 'attendance.absence',
            params: { student: params.student, date: session.date },
            link: `/attendance/students/${student.id}`,
            locales: new Map(
              recipients.map((guardian) => [guardian.userId, guardian.locale]),
            ),
            mail: (url, locale) => ({
              type: 'attendance.absence',
              url,
              params: { ...params, date: formatDate(session.date, locale) },
            }),
          });
        }
        record.notifiedAt = new Date();
      }
      await this.tx.save(unexplained);
      return unexplained.length;
    });
  }

  /** A guardian (or staff) explains a day's absence; it applies to every class that day (ATT-4). */
  async explain(studentId: string, date: string, reason: string) {
    await this.policy.assertStudentAccess(studentId);
    const staff = rolesAllow(this.context.roles, { attendance: ['take'] });
    const note =
      (await this.tx.findOneBy(AbsenceNote, { studentId, date })) ??
      this.tx.create(AbsenceNote, { studentId, date });
    await this.tx.save(
      Object.assign(note, {
        reason,
        submittedBy: this.context.requireUserId(),
      }),
    );
    const sessions = await this.tx.findBy(AttendanceSession, { date });
    if (sessions.length > 0) {
      await this.tx.update(
        AttendanceRecord,
        {
          studentId,
          sessionId: In(sessions.map((session) => session.id)),
          status: In(['absent', 'late']),
        },
        { reason, reasonSource: staff ? 'staff' : 'guardian' },
      );
    }
    return { date, reason };
  }

  // ── Summaries and reports ───────────────────────────────────────────

  /** Attendance for the portfolio and reports (ATT-6), with each day that wasn't "present". */
  async studentSummary(studentId: string, from: string, to: string) {
    await this.policy.assertStudentAccess(studentId);
    assertRange(from, to);
    const rows = await this.recordsBetween(from, to, {
      studentIds: [studentId],
    });
    const countsAs = await this.countsAsMap();
    return {
      ...summarize(rows.map((row) => countsAs.get(row.status) ?? 'present')),
      exceptions: rows
        .filter((row) => (countsAs.get(row.status) ?? 'present') !== 'present')
        .map((row) => ({
          date: row.date,
          classId: row.class_id,
          status: row.status,
          reason: row.reason,
        })),
    };
  }

  /** One line per student: counts and rate, by class, grade and date range (ATT-7). */
  async report({ from, to, classId, gradeLevelId }: ReportQueryDto) {
    if (!this.policy.isSchoolWide) throw new ForbiddenException();
    assertRange(from, to);
    const rows = await this.recordsBetween(from, to, {
      classIds: classId ? [classId] : undefined,
    });
    const countsAs = await this.countsAsMap();
    const students = (
      await this.people.studentsByIds([
        ...new Set(rows.map((row) => row.student_id)),
      ])
    )
      .filter(
        (student) => !gradeLevelId || student.gradeLevel?.id === gradeLevelId,
      )
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName),
      );
    return students.map((student) => ({
      student,
      ...summarize(
        rows
          .filter((row) => row.student_id === student.id)
          .map((row) => countsAs.get(row.status) ?? 'present'),
      ),
    }));
  }

  async reportCsv(query: ReportQueryDto): Promise<string> {
    const lines = await this.report(query);
    await this.audit.record({
      action: 'attendance.exported',
      entityType: 'attendance_report',
      after: {
        from: query.from,
        to: query.to,
        classId: query.classId,
        gradeLevelId: query.gradeLevelId,
        rows: lines.length,
      },
    });
    return toCsv([
      [
        'student_number',
        'last_name',
        'first_name',
        'grade_level',
        'sessions',
        'present',
        'late',
        'absent',
        'excused',
        'rate',
      ],
      ...lines.map(
        ({ student, sessions, present, late, absent, excused, rate }) => [
          student.studentNumber,
          student.lastName,
          student.firstName,
          student.gradeLevel?.name ?? null,
          sessions,
          present,
          late,
          absent,
          excused,
          rate === null ? null : Math.round(rate * 1000) / 1000,
        ],
      ),
    ]);
  }

  private async recordsBetween(
    from: string,
    to: string,
    filter: { studentIds?: string[]; classIds?: string[] },
  ) {
    const query = this.tx
      .createQueryBuilder(AttendanceRecord, 'record')
      .innerJoin(AttendanceSession, 'session', 'session.id = record.session_id')
      .select([
        'record.student_id AS student_id',
        'record.status AS status',
        'record.reason AS reason',
      ])
      .addSelect(['session.date::text AS date', 'session.class_id AS class_id'])
      .where('session.date BETWEEN :from AND :to', { from, to })
      .orderBy('session.date', 'ASC');
    if (filter.studentIds)
      query.andWhere('record.student_id IN (:...studentIds)', {
        studentIds: filter.studentIds,
      });
    if (filter.classIds)
      query.andWhere('session.class_id IN (:...classIds)', {
        classIds: filter.classIds,
      });
    return query.getRawMany<{
      student_id: string;
      status: string;
      reason: string | null;
      date: string;
      class_id: string;
    }>();
  }

  private async countsAsMap(): Promise<Map<string, CountsAs>> {
    return new Map(
      (await this.statuses()).map((status) => [status.code, status.countsAs]),
    );
  }

  /** Holidays and closures for the class's audiences (CAL-5). */
  private async isDayOff(classId: string, date: string): Promise<boolean> {
    const [schoolClass] = await this.academics.findClassesByIds([classId]);
    if (!schoolClass) throw new NotFoundException();
    const [level] = schoolClass.gradeLevel
      ? await this.academics.gradeLevelsByIds([schoolClass.gradeLevel.id])
      : [];
    const days = await this.calendar.daysOff(date, date, {
      classId,
      gradeLevelId: schoolClass.gradeLevel?.id ?? null,
      divisionId: level?.divisionId ?? null,
    });
    return days.has(date);
  }

  /** Sessions this week, for the "taken / not taken" view. */
  async sessionsFor(classIds: string[], from: string, to: string) {
    if (classIds.length === 0) return [];
    return this.tx.find(AttendanceSession, {
      where: { classId: In(classIds), date: Between(from, to) },
    });
  }
}

const pickStatus = ({ code, label, countsAs }: AttendanceStatusDto) => ({
  code,
  label,
  countsAs,
});

function problem(
  status: HttpStatus,
  code: string,
  field: string,
  fieldCode = code,
) {
  return new ProblemException(status, code, undefined, [
    { field, codes: [fieldCode === code ? camel(code) : fieldCode] },
  ]);
}

const camel = (code: string) =>
  code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

function assertRange(from: string, to: string) {
  const days = daysBetween(from, to);
  if (days < 0 || days > MAX_REPORT_DAYS) {
    throw new ProblemException(
      HttpStatus.BAD_REQUEST,
      'validation_failed',
      undefined,
      [{ field: 'to', codes: ['range'] }],
    );
  }
}

const formatDate = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
