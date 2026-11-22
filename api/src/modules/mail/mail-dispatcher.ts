import { Injectable } from '@nestjs/common';
import { Mailer } from '@nestjs/mail';
import { OnOutboxMessage, type OutboxHandlerContext } from '@nestjs/outbox';
import { MAIL_TOPIC, type QueuedMail } from './mail-outbox.service.js';
import { AccountSetupMail } from './mails/account-setup.mail.js';
import { InvitationMail } from './mails/invitation.mail.js';
import { NoticeMail } from './mails/notice.mail.js';
import { ResetPasswordMail } from './mails/reset-password.mail.js';
import { VerifyEmailMail } from './mails/verify-email.mail.js';

@Injectable()
export class MailDispatcher {
  constructor(private readonly mailer: Mailer) {}

  @OnOutboxMessage(MAIL_TOPIC, { consumer: 'mail-sender' })
  async send(queued: QueuedMail, { message }: OutboxHandlerContext) {
    const delivery = {
      to: queued.to,
      locale: queued.locale,
      idempotencyKey: message.id,
      retry: false as const,
    };

    switch (queued.mail) {
      case 'verify-email':
        return this.mailer.send(VerifyEmailMail, {
          ...delivery,
          data: queued.data,
        });
      case 'reset-password':
        return this.mailer.send(ResetPasswordMail, {
          ...delivery,
          data: queued.data,
        });
      case 'account-setup':
        return this.mailer.send(AccountSetupMail, {
          ...delivery,
          data: queued.data,
        });
      case 'invitation':
        return this.mailer.send(InvitationMail, {
          ...delivery,
          data: queued.data,
        });
      case 'notice':
        return this.mailer.send(NoticeMail, {
          ...delivery,
          data: queued.data,
        });
    }
  }
}
