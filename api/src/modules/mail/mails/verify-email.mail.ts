import { Injectable } from '@nestjs/common';
import type { Mailable, MailRenderContext } from '@nestjs/mail';
import { actionContext, translate } from '../mail-locale.js';

export interface VerifyEmailData {
  name: string;
  url: string;
}

@Injectable()
export class VerifyEmailMail implements Mailable<VerifyEmailData> {
  render({ name, url }: VerifyEmailData, { locale }: MailRenderContext) {
    return {
      subject: translate(locale, {
        en: 'Confirm your email address',
        fr: 'Confirmez votre adresse e-mail',
      }),
      template: 'verify-email',
      context: {
        name,
        ...actionContext(locale, url, {
          en: 'Confirm email',
          fr: 'Confirmer l’adresse',
        }),
      },
    };
  }
}
