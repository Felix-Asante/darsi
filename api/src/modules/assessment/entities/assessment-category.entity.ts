import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('assessment_categories')
export class AssessmentCategory extends TenantEntity {
  @Column('uuid')
  policyId: string;

  @Column('text')
  name: string;

  /** Relative weight of the category in the term result. */
  @Column('integer')
  weight: number;
}
