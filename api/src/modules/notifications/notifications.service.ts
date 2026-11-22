import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import type {
  CursorPage,
  CursorQueryDto,
} from '../../common/pagination/cursor-pagination.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { ConfigService } from '@nestjs/config';
import { appLink } from '../../common/http/app-links.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { MailOutbox } from '../mail/mail-outbox.service.js';
import type { NoticeData } from '../mail/mails/notice.mail.js';
import { Notification } from './notification.entity.js';
import {
  NOTIFICATION_TYPES,
  NotificationPreference,
  type NotificationType,
} from './notification-preference.entity.js';

export interface Delivery<T extends NotificationType = NotificationType> {
  userIds: string[];
  type: T;
  params: Notification['params'];
  /** App path, without the locale prefix. */
  link: string;
  /** The email for one reader; it gets the full link in their language. */
  mail?: (url: string, locale: string) => Extract<NoticeData, { type: T }>;
  /** Overrides each user's language, such as a guardian's chosen language for school mail. */
  locales?: Map<string, string>;
}

export interface NewNotification {
  userIds: string[];
  type: string;
  params?: Notification['params'];
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly mailOutbox: MailOutbox,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Tells people in-app and by email, as each of them chose (ANN-5). Mail is
   * queued in the caller's transaction, in the reader's language.
   */
  async deliver<T extends NotificationType>({
    userIds,
    type,
    params,
    link,
    mail,
    locales,
  }: Delivery<T>): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return;
    const preferences = await this.txHost.tx.findBy(NotificationPreference, {
      userId: In(recipients),
      type,
    });
    const choice = (userId: string) =>
      preferences.find((preference) => preference.userId === userId);

    await this.notify({
      userIds: recipients.filter((userId) => choice(userId)?.inApp ?? true),
      type,
      params,
      link,
    });
    if (!mail) return;

    const emailed = recipients.filter(
      (userId) => choice(userId)?.email ?? true,
    );
    if (emailed.length === 0) return;
    const users = await this.txHost.tx.query<
      { id: string; email: string; locale: string | null }[]
    >(`SELECT id, email, locale FROM users WHERE id = ANY($1)`, [emailed]);
    const [school] = await this.txHost.tx.query<{ default_locale: string }[]>(
      `SELECT default_locale FROM schools WHERE school_id = app_current_school_id()`,
    );
    const appUrl = this.config.get('APP_URL', { infer: true });
    for (const user of users) {
      const locale =
        locales?.get(user.id) ?? user.locale ?? school?.default_locale ?? 'en';
      await this.mailOutbox.queue({
        mail: 'notice',
        to: user.email,
        locale,
        data: mail(appLink(appUrl, locale, link), locale),
      });
    }
  }

  async preferences(): Promise<
    { type: NotificationType; inApp: boolean; email: boolean }[]
  > {
    const saved = await this.txHost.tx.findBy(NotificationPreference, {
      userId: this.context.requireUserId(),
    });
    return NOTIFICATION_TYPES.map((type) => {
      const preference = saved.find((candidate) => candidate.type === type);
      return {
        type,
        inApp: preference?.inApp ?? true,
        email: preference?.email ?? true,
      };
    });
  }

  async savePreference(
    type: NotificationType,
    inApp: boolean,
    email: boolean,
  ): Promise<void> {
    const userId = this.context.requireUserId();
    const existing = await this.txHost.tx.findOneBy(NotificationPreference, {
      userId,
      type,
    });
    await this.txHost.tx.save(
      Object.assign(
        existing ??
          this.txHost.tx.create(NotificationPreference, { userId, type }),
        { inApp, email },
      ),
    );
  }

  /** Adds a notice to each user's inbox in the current school, in the caller's transaction. */
  async notify({
    userIds,
    type,
    params = {},
    link,
  }: NewNotification): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return;

    await this.txHost.tx.insert(
      Notification,
      recipients.map((userId) => ({
        id: uuidv7(),
        userId,
        type,
        params,
        link: link ?? null,
      })),
    );
  }

  /** Newest first. Ids are UUIDv7, so the cursor walks backwards in time. */
  async list({
    cursor,
    limit,
  }: CursorQueryDto): Promise<CursorPage<Notification>> {
    const query = this.txHost.tx
      .createQueryBuilder(Notification, 'notification')
      .where('notification.user_id = :userId', {
        userId: this.context.requireUserId(),
      })
      .orderBy('notification.id', 'DESC')
      .take(limit + 1);
    if (cursor) query.andWhere('notification.id < :cursor', { cursor });

    const rows = await query.getMany();
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
    };
  }

  async unreadCount(): Promise<{ count: number }> {
    const count = await this.txHost.tx.countBy(Notification, {
      userId: this.context.requireUserId(),
      readAt: IsNull(),
    });
    return { count };
  }

  async markRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.txHost.tx.update(
      Notification,
      { id: In(ids), userId: this.context.requireUserId(), readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async markAllRead(): Promise<void> {
    await this.txHost.tx.update(
      Notification,
      { userId: this.context.requireUserId(), readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}
