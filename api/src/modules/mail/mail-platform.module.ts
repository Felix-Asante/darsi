import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileMailTransport,
  FileTemplateEngine,
  InMemoryMailTransport,
  LogMailTransport,
  MailModule,
  type MailTransport,
  ResendTransport,
} from '@nestjs/mail';
import { join } from 'node:path';
import {
  type EnvironmentVariables,
  MailTransportKind,
  NodeEnv,
} from '../../config/env.validation.js';
import { MailDispatcher } from './mail-dispatcher.js';
import { MailOutbox } from './mail-outbox.service.js';
import { AccountSetupMail } from './mails/account-setup.mail.js';
import { InvitationMail } from './mails/invitation.mail.js';
import { NoticeMail } from './mails/notice.mail.js';
import { ResetPasswordMail } from './mails/reset-password.mail.js';
import { VerifyEmailMail } from './mails/verify-email.mail.js';

function mailTransport(
  config: ConfigService<EnvironmentVariables, true>,
): MailTransport {
  switch (config.get('MAIL_TRANSPORT', { infer: true })) {
    case MailTransportKind.Resend: {
      const apiKey = config.get('RESEND_API_KEY', { infer: true });
      if (!apiKey)
        throw new Error(
          'RESEND_API_KEY is required when MAIL_TRANSPORT is "resend"',
        );
      return new ResendTransport({ apiKey });
    }
    case MailTransportKind.Log:
      return new LogMailTransport();
    case MailTransportKind.Memory:
      return new InMemoryMailTransport();
    case MailTransportKind.File:
      return new FileMailTransport({ directory: 'var/mail' });
  }
}

@Global()
@Module({
  imports: [
    MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        transport: mailTransport(config),
        templates: new FileTemplateEngine({
          dir: join(import.meta.dirname, 'templates'),
          layout: 'layout',
          cache: config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
        }),
        from: config.get('MAIL_FROM', { infer: true }),
      }),
    }),
  ],
  providers: [
    MailOutbox,
    MailDispatcher,
    VerifyEmailMail,
    ResetPasswordMail,
    AccountSetupMail,
    InvitationMail,
    NoticeMail,
  ],
  exports: [MailOutbox],
})
export class MailPlatformModule {}
