import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';

/** What a division's reports contain (RPT-1). Without a division, the school's default. */
@Entity('report_templates')
export class ReportTemplate extends TenantEntity {
  @Column('uuid', { nullable: true })
  divisionId: string | null;

  @Column('text')
  name: string;

  /** Subjects on the report; empty means every subject the student takes. */
  @Column('uuid', { array: true })
  subjectIds: string[];

  @Column('boolean')
  includeAttendance: boolean;

  @Column('boolean')
  includeGeneralComment: boolean;
}

export type ReportStatus = 'draft' | 'returned' | 'approved' | 'published';

export interface AttendanceSnapshot {
  rate: number | null;
  sessions: number;
  absent: number;
  late: number;
}

/** One student's report for one term. Results and attendance are fixed when it is approved. */
@Entity('report_cards')
export class ReportCard extends TenantEntity {
  @Column('uuid')
  termId: string;

  @Column('uuid')
  studentId: string;

  @Column('uuid', { nullable: true })
  templateId: string | null;

  @Column('text')
  status: ReportStatus;

  @Column('text', { nullable: true })
  generalComment: string | null;

  /** Why the reviewer sent it back (RPT-4). */
  @Column('text', { nullable: true })
  returnNote: string | null;

  @Column('jsonb', { nullable: true })
  attendance: AttendanceSnapshot | null;

  @Column('text')
  locale: 'en' | 'fr';

  @Column('uuid', { nullable: true })
  fileId: string | null;

  @Column('uuid', { nullable: true })
  approvedBy: string | null;

  @Column('timestamptz', { nullable: true })
  approvedAt: Date | null;

  @Column('timestamptz', { nullable: true })
  publishedAt: Date | null;
}

/** One subject on a report: the class's term result and the teacher's comment (RPT-2). */
@Entity('report_entries')
export class ReportEntry extends TenantEntity {
  @Column('uuid')
  cardId: string;

  @Column('uuid')
  classId: string;

  @Column('text', { nullable: true })
  subjectName: string | null;

  @Column('text', { nullable: true })
  resultValue: string | null;

  @Column('text', { nullable: true })
  reportingScaleName: string | null;

  @Column('text', { nullable: true })
  comment: string | null;

  @Column('uuid', { nullable: true })
  commentBy: string | null;
}

export const REPORT_PII_FIELDS = ['generalComment', 'returnNote'] as const;
