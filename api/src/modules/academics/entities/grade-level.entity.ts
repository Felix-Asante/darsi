import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('grade_levels')
export class GradeLevel extends TenantEntity {
  @Column('uuid')
  divisionId: string;

  @Column('text')
  name: string;

  @Column('integer')
  sortOrder: number;
}
