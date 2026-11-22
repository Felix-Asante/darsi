import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('subjects')
export class Subject extends TenantEntity {
  @Column('text')
  code: string;

  @Column('text')
  name: string;
}
