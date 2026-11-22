import { Injectable } from '@nestjs/common';
import type { Mailable, MailRenderContext } from '@nestjs/mail';
import { actionContext, translate } from '../mail-locale.js';

export interface ResetPasswordData {
  name: string;
  url: string;
}

@Injectable()
export class ResetPasswordMail implements Mailable<ResetPasswordData> {
  render({ name, url }: ResetPasswordData, { locale }: MailRenderContext) {
    return {
      subject: translate(locale, {
        en: 'Reset your Darsi password',
        fr: 'Réinitialisez votre mot de passe Darsi',
      }),
      template: 'reset-password',
      context: {
        name,
        ...actionContext(locale, url, {
          en: 'Choose a new password',
          fr: 'Choisir un nouveau mot de passe',
        }),
      },
    };
  }
}
