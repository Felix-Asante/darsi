import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('divisions')
export class Division extends TenantEntity {
  @Column('text')
  name: string;

  @Column('integer')
  sortOrder: number;
}
