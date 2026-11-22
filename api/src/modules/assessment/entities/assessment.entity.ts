import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const ASSESSMENT_KINDS = ['formative', 'summative'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

@Entity('assessments')
export class Assessment extends TenantEntity {
  @Column('uuid')
  classId: string;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('text')
  kind: AssessmentKind;

  @Column('date', { nullable: true })
  dueOn: string | null;

  @Column('uuid')
  scaleId: string;

  @Column('integer')
  scaleVersion: number;

  @Column('uuid', { nullable: true })
  categoryId: string | null;

  /** Weight inside its category. */
  @Column('double precision')
  weight: number;

  @Column('uuid', { nullable: true })
  createdBy: string | null;
}
