import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export type StudentStatus = 'active' | 'withdrawn';

@Entity('students')
export class Student extends TenantEntity {
  /** The student's own Darsi account, if they have one. */
  @Column('uuid', { nullable: true })
  userId: string | null;

  @Column('uuid', { nullable: true })
  familyId: string | null;

  @Column('uuid', { nullable: true })
  gradeLevelId: string | null;

  @Column('text')
  studentNumber: string;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('text', { nullable: true })
  preferredName: string | null;

  @Column('date', { nullable: true })
  dateOfBirth: string | null;

  @Column('text', { nullable: true })
  email: string | null;

  @Column('text')
  status: StudentStatus;

  @Column('date', { nullable: true })
  enrolledOn: string | null;

  @Column('date', { nullable: true })
  withdrawnOn: string | null;

  @Column('text', { nullable: true })
  withdrawalReason: string | null;
}

/** Personal data columns, used by export, deletion and pseudonymisation. */
export const STUDENT_PII_FIELDS = [
  'firstName',
  'lastName',
  'preferredName',
  'dateOfBirth',
  'email',
] as const;
