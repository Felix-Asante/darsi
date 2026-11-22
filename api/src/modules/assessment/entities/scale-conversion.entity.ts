import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';
import type { ExplicitMapping } from '../grading/types.js';

/**
 * A school's conversion table between two scales. Saving adds a row; the one
 * in effect when a grade was published is the one used to show it, so a later
 * change never alters past grades.
 */
@Entity('scale_conversions')
export class ScaleConversion extends TenantEntity {
  @Column('uuid')
  fromScaleId: string;

  @Column('uuid')
  toScaleId: string;

  @Column('jsonb')
  mapping: ExplicitMapping;

  @Column('timestamptz')
  effectiveFrom: Date;

  @Column('uuid', { nullable: true })
  createdBy: string | null;
}
