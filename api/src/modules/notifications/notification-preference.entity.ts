import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';

/** Notice types people can choose how to receive (ANN-5). */
export const NOTIFICATION_TYPES = [
  'announcement.published',
  'attendance.absence',
  'grade.published',
  'report.published',
  'invoice.reminder',
  'payment.received',
  'admission.update',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A user's choice for one type in one school. Without a row, both channels are on. */
@Entity('notification_preferences')
export class NotificationPreference extends TenantEntity {
  @Column('uuid')
  userId: string;

  @Column('text')
  type: NotificationType;

  @Column('boolean')
  inApp: boolean;

  @Column('boolean')
  email: boolean;
}
