import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export type GradeStatus = 'draft' | 'published';

@Entity('grades')
export class Grade extends TenantEntity {
  @Column('uuid')
  assessmentId: string;

  @Column('uuid')
  studentId: string;

  /** On the assessment's scale and version. For a rubric, the overall result of the criteria. */
  @Column('text', { nullable: true })
  value: string | null;

  /** 0–1, fixed when the grade is saved with the scale version of the time. */
  @Column('double precision', { nullable: true })
  mastery: number | null;

  /** Rubric criterion id → value on the criterion's scale. */
  @Column('jsonb')
  criterionValues: Record<string, string>;

  @Column('text', { nullable: true })
  comment: string | null;

  @Column('boolean')
  excused: boolean;

  @Column('text')
  status: GradeStatus;

  @Column('uuid', { nullable: true })
  enteredBy: string | null;

  @Column('timestamptz', { nullable: true })
  publishedAt: Date | null;

  @Column('uuid', { nullable: true })
  publishedBy: string | null;
}

/** Teacher comments are about a child, so they are personal data. */
export const GRADE_PII_FIELDS = ['comment'] as const;
