import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const EVENT_KINDS = ['holiday', 'closure', 'exam', 'event'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const AUDIENCES = [
  'school',
  'division',
  'grade_level',
  'class',
] as const;
export type AudienceKind = (typeof AUDIENCES)[number];

/** Holidays and closures cancel timetabled lessons and attendance for their audience. */
export const DAY_OFF_KINDS: EventKind[] = ['holiday', 'closure'];

@Entity('calendar_events')
export class CalendarEvent extends TenantEntity {
  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('text')
  kind: EventKind;

  @Column('date')
  startsOn: string;

  /** Inclusive. Equal to `startsOn` for a one-day event. */
  @Column('date')
  endsOn: string;

  /** Local school time, `HH:MM:SS`. Null for all-day events. */
  @Column('time', { nullable: true })
  startTime: string | null;

  @Column('time', { nullable: true })
  endTime: string | null;

  /** An RFC 5545 RRULE in the subset `recurrence.ts` accepts. */
  @Column('text', { nullable: true })
  recurrence: string | null;

  @Column('text')
  audience: AudienceKind;

  @Column('uuid', { nullable: true })
  audienceId: string | null;

  @Column('uuid', { nullable: true })
  createdBy: string | null;
}
