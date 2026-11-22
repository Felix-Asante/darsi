import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';
import type { ScaleKind } from '../grading/types.js';

@Entity('grading_scales')
export class GradingScale extends TenantEntity {
  @Column('text')
  name: string;

  @Column('text')
  kind: ScaleKind;

  @Column('integer')
  currentVersion: number;
}
