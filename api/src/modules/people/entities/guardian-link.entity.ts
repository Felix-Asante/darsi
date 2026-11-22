import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const RELATIONSHIPS = [
  'mother',
  'father',
  'parent',
  'guardian',
  'grandparent',
  'other',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

/** Which guardian may see and act for which student. */
@Entity('guardian_links')
export class GuardianLink extends TenantEntity {
  @Column('uuid')
  guardianId: string;

  @Column('uuid')
  studentId: string;

  @Column('text')
  relationship: Relationship;

  @Column('boolean')
  isPrimaryContact: boolean;
}
