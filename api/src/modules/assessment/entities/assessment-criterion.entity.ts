import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

/** One rubric criterion, graded on its own scale. */
@Entity('assessment_criteria')
export class AssessmentCriterion extends TenantEntity {
  @Column('uuid')
  assessmentId: string;

  @Column('text')
  name: string;

  @Column('uuid')
  scaleId: string;

  @Column('integer')
  scaleVersion: number;

  @Column('double precision')
  weight: number;

  @Column('integer')
  sortOrder: number;
}
