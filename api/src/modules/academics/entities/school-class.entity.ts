import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('classes')
export class SchoolClass extends TenantEntity {
  @Column('uuid')
  academicYearId: string;

  @Column('uuid', { nullable: true })
  gradeLevelId: string | null;

  @Column('uuid', { nullable: true })
  subjectId: string | null;

  @Column('text')
  code: string;

  @Column('text')
  name: string;
}
