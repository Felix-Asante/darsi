import { Column } from 'typeorm';
import { BaseEntity } from './base.entity.js';

/** Tables built on this must call `enableTenantIsolation()` in their migration. */
export abstract class TenantEntity extends BaseEntity {
  @Column('uuid')
  schoolId: string;
}
