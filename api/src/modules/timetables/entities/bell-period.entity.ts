import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('bell_periods')
export class BellPeriod extends TenantEntity {
  @Column('uuid')
  bellScheduleId: string;

  @Column('text')
  name: string;

  /** Local school time, `HH:MM:SS`. */
  @Column('time')
  startsAt: string;

  @Column('time')
  endsAt: string;

  @Column('integer')
  sortOrder: number;
}
