import { Injectable } from '@nestjs/common';
import type { Mailable, MailRenderContext } from '@nestjs/mail';
import { actionContext, translate } from '../mail-locale.js';

export interface AccountSetupData {
  name: string;
  schoolName: string;
  url: string;
}

@Injectable()
export class AccountSetupMail implements Mailable<AccountSetupData> {
  render(
    { name, schoolName, url }: AccountSetupData,
    { locale }: MailRenderContext,
  ) {
    return {
      subject: translate(locale, {
        en: `Your Darsi account for ${schoolName}`,
        fr: `Votre compte Darsi pour ${schoolName}`,
      }),
      template: 'account-setup',
      context: {
        name,
        schoolName,
        ...actionContext(locale, url, {
          en: 'Choose your password',
          fr: 'Choisir mon mot de passe',
        }),
      },
    };
  }
}
