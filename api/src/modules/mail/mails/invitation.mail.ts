import { Injectable } from '@nestjs/common';
import type { Mailable, MailRenderContext } from '@nestjs/mail';
import type { Role } from '../../auth/access-control.js';
import { actionContext, mailLocale, translate } from '../mail-locale.js';

export interface InvitationData {
  inviterName: string;
  schoolName: string;
  roles: Role[];
  url: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<Role, { en: string; fr: string }> = {
  admin: { en: 'an administrator', fr: 'administrateur' },
  admissions_officer: {
    en: 'an admissions officer',
    fr: 'responsable des admissions',
  },
  finance_officer: { en: 'a finance officer', fr: 'responsable financier' },
  coordinator: { en: 'a coordinator', fr: 'coordinateur' },
  teacher: { en: 'a teacher', fr: 'enseignant' },
  teaching_assistant: {
    en: 'a teaching assistant',
    fr: 'assistant d’enseignement',
  },
  class_member: { en: 'a class member', fr: 'membre de classe' },
  student: { en: 'a student', fr: 'élève' },
  guardian: { en: 'a parent or guardian', fr: 'parent ou responsable légal' },
  applicant: { en: 'an applicant family', fr: 'famille candidate' },
};

@Injectable()
export class InvitationMail implements Mailable<InvitationData> {
  render(
    { inviterName, schoolName, roles, url, expiresAt }: InvitationData,
    { locale }: MailRenderContext,
  ) {
    const language = mailLocale(locale);
    const roleLabel = new Intl.ListFormat(language, {
      type: 'conjunction',
    }).format(roles.map((role) => ROLE_LABELS[role][language]));

    return {
      subject: translate(locale, {
        en: `Join ${schoolName} on Darsi`,
        fr: `Rejoignez ${schoolName} sur Darsi`,
      }),
      template: 'invitation',
      context: {
        inviterName,
        schoolName,
        roleLabel,
        expiresOn: new Intl.DateTimeFormat(language, {
          dateStyle: 'long',
          timeZone: 'UTC',
        }).format(new Date(expiresAt)),
        ...actionContext(locale, url, {
          en: 'Accept invitation',
          fr: 'Accepter l’invitation',
        }),
      },
    };
  }
}
