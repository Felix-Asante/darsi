import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const ROTATION_KINDS = ['weekly', 'cycle'] as const;
export type RotationKind = (typeof ROTATION_KINDS)[number];

/** The periods of a school day for one division, or the whole school when `divisionId` is null. */
@Entity('bell_schedules')
export class BellSchedule extends TenantEntity {
  @Column('uuid', { nullable: true })
  divisionId: string | null;

  @Column('text')
  name: string;

  @Column('text')
  rotationKind: RotationKind;

  /** Weeks for a weekly rotation (2 for Week A/B), days for a day cycle (6 for days 1–6). */
  @Column('integer')
  rotationLength: number;

  /** ISO weekdays in week order, 1 for Monday. */
  @Column('smallint', { array: true })
  weekdays: number[];
}
