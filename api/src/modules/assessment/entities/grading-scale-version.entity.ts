import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';
import type { GradingScaleSnapshot } from '../grading/types.js';

/** Immutable (a trigger refuses updates). Editing a scale adds a version instead. */
@Entity('grading_scale_versions')
export class GradingScaleVersion extends TenantEntity {
  @Column('uuid')
  scaleId: string;

  @Column('integer')
  scaleVersion: number;

  @Column('jsonb')
  definition: GradingScaleSnapshot;
}
