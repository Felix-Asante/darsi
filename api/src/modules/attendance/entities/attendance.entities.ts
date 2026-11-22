import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const ATTENDANCE_MODES = ['daily', 'period'] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

/** The four meanings every status reduces to, for summaries and reports. */
export const COUNTS_AS = ['present', 'absent', 'late', 'excused'] as const;
export type CountsAs = (typeof COUNTS_AS)[number];

@Entity('attendance_settings')
export class AttendanceSettings extends TenantEntity {
  @Column('text')
  mode: AttendanceMode;

  /** How long after attendance is taken guardians hear about an unexplained absence (ATT-5). */
  @Column('integer')
  notifyAfterMinutes: number;
}

/** A school's own status, such as "field trip", counted as one of the four built-in ones. */
@Entity('attendance_statuses')
export class AttendanceStatus extends TenantEntity {
  @Column('text')
  code: string;

  @Column('text')
  label: string;

  @Column('text')
  countsAs: CountsAs;

  @Column('integer')
  sortOrder: number;
}

/** Attendance for one class on one day, or one period of it. */
@Entity('attendance_sessions')
export class AttendanceSession extends TenantEntity {
  @Column('uuid')
  classId: string;

  @Column('date')
  date: string;

  @Column('uuid', { nullable: true })
  periodId: string | null;

  @Column('uuid', { nullable: true })
  takenBy: string | null;

  @Column('timestamptz')
  takenAt: Date;
}

@Entity('attendance_records')
export class AttendanceRecord extends TenantEntity {
  @Column('uuid')
  sessionId: string;

  @Column('uuid')
  studentId: string;

  @Column('text')
  status: string;

  @Column('text', { nullable: true })
  reason: string | null;

  @Column('text', { nullable: true })
  reasonSource: 'staff' | 'guardian' | null;

  @Column('timestamptz', { nullable: true })
  notifiedAt: Date | null;
}

/** A reason for a day's absence, sent ahead or after the fact. */
@Entity('absence_notes')
export class AbsenceNote extends TenantEntity {
  @Column('uuid')
  studentId: string;

  @Column('date')
  date: string;

  @Column('text')
  reason: string;

  @Column('uuid', { nullable: true })
  submittedBy: string | null;
}

export const ABSENCE_PII_FIELDS = ['reason'] as const;
