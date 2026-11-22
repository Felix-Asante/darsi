import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

/** A part of the academic year. Gradebook, report and billing periods follow terms. */
@Entity('terms')
export class Term extends TenantEntity {
  @Column('uuid')
  academicYearId: string;

  @Column('text')
  name: string;

  @Column('date')
  startsOn: string;

  @Column('date')
  endsOn: string;
}
