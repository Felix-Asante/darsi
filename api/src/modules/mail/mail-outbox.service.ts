import { Injectable } from '@nestjs/common';
import { Outbox } from '@nestjs/outbox';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import type { AccountSetupData } from './mails/account-setup.mail.js';
import type { InvitationData } from './mails/invitation.mail.js';
import type { NoticeData } from './mails/notice.mail.js';
import type { ResetPasswordData } from './mails/reset-password.mail.js';
import type { VerifyEmailData } from './mails/verify-email.mail.js';

export const MAIL_TOPIC = 'mail.send';

interface MailPayloads {
  'verify-email': VerifyEmailData;
  'reset-password': ResetPasswordData;
  'account-setup': AccountSetupData;
  invitation: InvitationData;
  notice: NoticeData;
}

export type MailName = keyof MailPayloads;

export type QueuedMail = {
  [Name in MailName]: {
    mail: Name;
    to: string;
    locale?: string;
    data: MailPayloads[Name];
  };
}[MailName];

/**
 * Mail goes out through the outbox: it commits with the change that caused it,
 * survives restarts, and is retried by the worker if the provider is down.
 */
@Injectable()
export class MailOutbox {
  constructor(
    private readonly outbox: Outbox<EntityManager>,
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly dataSource: DataSource,
  ) {}

  /** Joins the current transaction when there is one, otherwise commits on its own. */
  async queue(mail: QueuedMail): Promise<void> {
    const message = { topic: MAIL_TOPIC, payload: mail };
    if (this.txHost.isTransactionActive()) {
      await this.outbox.add(this.txHost.tx, message);
    } else {
      await this.dataSource.transaction(async (manager) => {
        await this.outbox.add(manager, message);
      });
    }
    this.outbox.notify();
  }
}
