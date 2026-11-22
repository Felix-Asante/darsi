import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('submissions')
export class Submission extends TenantEntity {
  @Column('uuid')
  assessmentId: string;

  @Column('uuid')
  studentId: string;

  @Column('text', { nullable: true })
  body: string | null;

  /** A file handed in, in addition to or instead of text. */
  @Column('uuid', { nullable: true })
  fileId: string | null;

  @Column('timestamptz')
  submittedAt: Date;

  /** Submitted after the due date, in the school's time zone. */
  @Column('boolean')
  isLate: boolean;
}

export const SUBMISSION_PII_FIELDS = ['body'] as const;
