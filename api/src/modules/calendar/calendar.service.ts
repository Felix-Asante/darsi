import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Brackets } from 'typeorm';
import { addDays, daysBetween } from '../../common/dates/calendar-date.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { type Audience, PolicyService } from '../policies/policy.service.js';
import type { CalendarEventDto } from './dto/calendar.dto.js';
import {
  CalendarEvent,
  DAY_OFF_KINDS,
  type EventKind,
} from './entities/calendar-event.entity.js';
import { occurrencesBetween, parseRecurrence } from './recurrence.js';

/** One entry on someone's calendar: an event occurrence, or an item another module places there. */
export interface CalendarItem {
  id: string;
  source: string;
  kind: string;
  title: string;
  description: string | null;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  /** Set for school events, so managers can edit the series. */
  eventId?: string;
  recurring?: boolean;
  /** An app path for the item, such as an assessment. */
  link?: string;
}

/** Later modules (assessments, fees) add their due dates through this (CAL-6). */
export type CalendarSource = (
  from: string,
  to: string,
) => Promise<CalendarItem[]>;

/** Which classes, grade levels and divisions a day off applies to. */
export interface DayOffScope {
  divisionId: string | null;
  gradeLevelId: string | null;
  classId: string;
}

const MAX_RANGE_DAYS = 100;

@Injectable()
export class CalendarService {
  private readonly sources = new Map<string, CalendarSource>();

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  registerSource(name: string, source: CalendarSource): void {
    this.sources.set(name, source);
  }

  /** The signed-in user's calendar: events for their audiences, and items from other modules. */
  async items(from: string, to: string): Promise<CalendarItem[]> {
    assertRange(from, to);
    const seesAll =
      this.policy.isSchoolWide ||
      rolesAllow(this.context.roles, { calendar: ['manage'] });
    const audience = seesAll ? null : await this.policy.audience();
    const events = await this.eventsBetween(from, to, audience);

    const items = events.flatMap((event) => this.expand(event, from, to));
    for (const [name, source] of this.sources) {
      items.push(
        ...(await source(from, to)).map((item) => ({ ...item, source: name })),
      );
    }
    return items.sort(
      (a, b) =>
        a.startsOn.localeCompare(b.startsOn) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    );
  }

  /** Holidays and closures in `from`–`to` that apply to a class, as a set of dates. */
  async daysOff(
    from: string,
    to: string,
    scope: DayOffScope,
  ): Promise<Set<string>> {
    const audience: Audience = {
      classIds: [scope.classId],
      gradeLevelIds: scope.gradeLevelId ? [scope.gradeLevelId] : [],
      divisionIds: scope.divisionId ? [scope.divisionId] : [],
    };
    const events = await this.eventsBetween(from, to, audience, DAY_OFF_KINDS);
    const days = new Set<string>();
    for (const event of events) {
      const length = daysBetween(event.startsOn, event.endsOn);
      for (const start of occurrencesBetween(
        event.startsOn,
        length,
        this.rule(event),
        from,
        to,
      )) {
        for (let offset = 0; offset <= length; offset += 1)
          days.add(addDays(start, offset));
      }
    }
    return days;
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    const event = await this.tx.findOneBy(CalendarEvent, { id });
    if (!event) throw new NotFoundException();
    return event;
  }

  async createEvent(dto: CalendarEventDto): Promise<CalendarEvent> {
    const values = await this.validated(dto);
    return this.tx.save(
      this.tx.create(CalendarEvent, {
        ...values,
        createdBy: this.context.requireUserId(),
      }),
    );
  }

  async updateEvent(id: string, dto: CalendarEventDto): Promise<CalendarEvent> {
    const event = await this.getEvent(id);
    return this.tx.save(Object.assign(event, await this.validated(dto)));
  }

  async deleteEvent(id: string): Promise<void> {
    const result = await this.tx.delete(CalendarEvent, { id });
    if (!result.affected) throw new NotFoundException();
  }

  private async eventsBetween(
    from: string,
    to: string,
    audience: Audience | null,
    kinds?: EventKind[],
  ) {
    const query = this.tx
      .createQueryBuilder(CalendarEvent, 'event')
      .where('event.starts_on <= :to', { to })
      .andWhere(
        new Brackets((where) =>
          where
            .where('event.recurrence IS NOT NULL')
            .orWhere('event.ends_on >= :from', { from }),
        ),
      );
    if (kinds) query.andWhere('event.kind IN (:...kinds)', { kinds });
    if (audience) {
      query.andWhere(
        new Brackets((where) =>
          where
            .where(`event.audience = 'school'`)
            .orWhere(
              `event.audience = 'division' AND event.audience_id = ANY(:divisionIds)`,
              { divisionIds: audience.divisionIds },
            )
            .orWhere(
              `event.audience = 'grade_level' AND event.audience_id = ANY(:gradeLevelIds)`,
              {
                gradeLevelIds: audience.gradeLevelIds,
              },
            )
            .orWhere(
              `event.audience = 'class' AND event.audience_id = ANY(:classIds)`,
              { classIds: audience.classIds },
            ),
        ),
      );
    }
    return query.getMany();
  }

  private rule(event: CalendarEvent) {
    return event.recurrence ? parseRecurrence(event.recurrence) : null;
  }

  private expand(
    event: CalendarEvent,
    from: string,
    to: string,
  ): CalendarItem[] {
    const length = daysBetween(event.startsOn, event.endsOn);
    return occurrencesBetween(
      event.startsOn,
      length,
      this.rule(event),
      from,
      to,
    ).map((start) => ({
      id: `${event.id}:${start}`,
      source: 'event',
      kind: event.kind,
      title: event.title,
      description: event.description,
      startsOn: start,
      endsOn: addDays(start, length),
      startTime: event.startTime?.slice(0, 5) ?? null,
      endTime: event.endTime?.slice(0, 5) ?? null,
      eventId: event.id,
      recurring: event.recurrence !== null,
    }));
  }

  private async validated(dto: CalendarEventDto) {
    const endsOn = dto.endsOn ?? dto.startsOn;
    const fieldError = (field: string, code: string) =>
      new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field, codes: [code] }],
      );
    if (endsOn < dto.startsOn) throw fieldError('endsOn', 'afterStart');
    if (Boolean(dto.startTime) !== Boolean(dto.endTime))
      throw fieldError(dto.startTime ? 'endTime' : 'startTime', 'required');
    if (dto.startTime && dto.endTime && dto.endTime <= dto.startTime)
      throw fieldError('endTime', 'afterStart');
    if ((dto.audience === 'school') !== !dto.audienceId)
      throw fieldError(
        'audienceId',
        dto.audienceId ? 'notAllowed' : 'required',
      );
    await this.assertAudienceExists(dto);

    return {
      title: dto.title,
      description: dto.description || null,
      kind: dto.kind,
      startsOn: dto.startsOn,
      endsOn,
      startTime: dto.startTime || null,
      endTime: dto.endTime || null,
      recurrence: dto.recurrence
        ? dto.recurrence.replace(/^RRULE:/i, '').toUpperCase()
        : null,
      audience: dto.audience,
      audienceId: dto.audienceId ?? null,
    };
  }

  private async assertAudienceExists({
    audience,
    audienceId,
  }: CalendarEventDto) {
    if (!audienceId) return;
    const lookups = {
      division: () => this.academics.findDivision(audienceId),
      grade_level: () => this.academics.findGradeLevel(audienceId),
      class: () => this.academics.findClass(audienceId),
    } as const;
    try {
      await lookups[audience as keyof typeof lookups]();
    } catch {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'audienceId', codes: ['notFound'] }],
      );
    }
  }
}

function assertRange(from: string, to: string) {
  const days = daysBetween(from, to);
  if (days < 0 || days > MAX_RANGE_DAYS) {
    throw new ProblemException(
      HttpStatus.BAD_REQUEST,
      'validation_failed',
      undefined,
      [{ field: 'to', codes: ['range'] }],
    );
  }
}
