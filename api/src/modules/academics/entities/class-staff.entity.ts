import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const CLASS_STAFF_ROLES = [
  'teacher',
  'teaching_assistant',
  'class_member',
] as const;
export type ClassStaffRole = (typeof CLASS_STAFF_ROLES)[number];

/** Who works with a class. Students belong to it through enrolments instead. */
@Entity('class_staff')
export class ClassStaff extends TenantEntity {
  @Column('uuid')
  classId: string;

  @Column('uuid')
  userId: string;

  @Column('text')
  role: ClassStaffRole;
}
