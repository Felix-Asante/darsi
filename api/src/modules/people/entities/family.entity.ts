import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

/** Guardians and siblings who share a household. Invoices are billed to a family. */
@Entity('families')
export class Family extends TenantEntity {
  @Column('text')
  name: string;
}
