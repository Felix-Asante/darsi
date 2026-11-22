import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

/** A class meets in this period on this day of the rotation. */
@Entity('timetable_slots')
export class TimetableSlot extends TenantEntity {
  @Column('uuid')
  classId: string;

  @Column('uuid')
  periodId: string;

  @Column('integer')
  cycleDay: number;

  @Column('text', { nullable: true })
  room: string | null;

  /** A teacher for this slot only, when it isn't the class's usual teacher. */
  @Column('uuid', { nullable: true })
  teacherUserId: string | null;
}
