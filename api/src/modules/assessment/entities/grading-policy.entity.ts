import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';
import type { AggregationMethod } from '../grading/types.js';

/** How term results are calculated for a subject, or for the school when `subjectId` is null. */
@Entity('grading_policies')
export class GradingPolicy extends TenantEntity {
  @Column('uuid', { nullable: true })
  subjectId: string | null;

  @Column('uuid', { nullable: true })
  reportingScaleId: string | null;

  @Column('text')
  method: AggregationMethod;
}
