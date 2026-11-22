import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

@Entity('guardians')
export class Guardian extends TenantEntity {
  /** The guardian's Darsi account, linked when they join with this email. */
  @Column('uuid', { nullable: true })
  userId: string | null;

  @Column('uuid', { nullable: true })
  familyId: string | null;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('text')
  email: string;

  @Column('text', { nullable: true })
  phone: string | null;

  @Column('text')
  preferredLocale: 'en' | 'fr';
}

export const GUARDIAN_PII_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
] as const;
