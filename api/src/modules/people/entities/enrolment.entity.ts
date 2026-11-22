import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

/** A student in a class from `startsOn` until `endsOn` (open while null). Never deleted, so history stays. */
@Entity('enrolments')
export class Enrolment extends TenantEntity {
  @Column('uuid')
  studentId: string;

  @Column('uuid')
  classId: string;

  @Column('date')
  startsOn: string;

  @Column('date', { nullable: true })
  endsOn: string | null;
}
