import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('assessment_standards')
export class AssessmentStandard extends TenantEntity {
  @Column('uuid')
  assessmentId: string;

  @Column('uuid')
  standardId: string;
}
