import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

/** A curriculum or set of standards the school teaches to, such as IB MYP Sciences or Common Core Math. */
@Entity('frameworks')
export class Framework extends TenantEntity {
  @Column('text')
  code: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string | null;
}
