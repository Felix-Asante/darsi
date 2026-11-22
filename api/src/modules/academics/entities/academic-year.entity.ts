import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('academic_years')
export class AcademicYear extends TenantEntity {
  @Column('text')
  name: string;

  @Column('date')
  startsOn: string;

  @Column('date')
  endsOn: string;

  @Column('boolean')
  isCurrent: boolean;
}
