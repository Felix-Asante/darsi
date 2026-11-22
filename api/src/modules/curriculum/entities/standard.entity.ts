import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('standards')
export class Standard extends TenantEntity {
  @Column('uuid')
  frameworkId: string;

  @Column('uuid', { nullable: true })
  parentId: string | null;

  @Column('text')
  code: string;

  @Column('text')
  description: string;

  @Column('integer')
  sortOrder: number;
}
