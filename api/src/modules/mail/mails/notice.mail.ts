import { Injectable } from '@nestjs/common';
import type { Mailable, MailRenderContext } from '@nestjs/mail';
import { actionContext, type MailLocale, translate } from '../mail-locale.js';

/** What a notice is about, and the values its copy needs. */
export type NoticeData =
  | {
      type: 'attendance.absence';
      url: string;
      params: {
        student: string;
        status: 'absent' | 'late';
        className: string;
        date: string;
      };
    }
  | {
      type: 'announcement.published';
      url: string;
      params: { title: string; author: string; excerpt: string };
    }
  | { type: 'grade.published'; url: string; params: { assessment: string } }
  | {
      type: 'report.published';
      url: string;
      params: { student: string; term: string };
    }
  | {
      type: 'invoice.reminder';
      url: string;
      params: {
        number: string;
        amount: string;
        dueDate: string;
        overdue: boolean;
      };
    }
  | {
      type: 'payment.received';
      url: string;
      params: { receipt: string; amount: string };
    }
  | {
      type: 'admission.update';
      url: string;
      /** The school's own copy for the stage, already in the family's language. */
      params: { subject: string; body: string };
    };

type Copy = { subject: string; paragraphs: string[]; action: string };

const STATUS: Record<MailLocale, Record<'absent' | 'late', string>> = {
  en: { absent: 'absent', late: 'late' },
  fr: { absent: 'absent(e)', late: 'en retard' },
};

function copyFor(data: NoticeData, locale: string | undefined): Copy {
  switch (data.type) {
    case 'attendance.absence': {
      const { student, className, date } = data.params;
      const status = translate(locale, STATUS)[data.params.status];
      return translate(locale, {
        en: {
          subject: `${student} was marked ${status}`,
          paragraphs: [
            `${student} was marked ${status} in ${className} on ${date}.`,
            'If you know why, you can tell the school from Darsi.',
          ],
          action: 'Give a reason',
        },
        fr: {
          subject: `${student} a été noté(e) ${status}`,
          paragraphs: [
            `${student} a été noté(e) ${status} en ${className} le ${date}.`,
            'Si vous en connaissez la raison, vous pouvez l’indiquer à l’établissement depuis Darsi.',
          ],
          action: 'Indiquer une raison',
        },
      });
    }
    case 'announcement.published': {
      const { title, author, excerpt } = data.params;
      return translate(locale, {
        en: {
          subject: title,
          paragraphs: [`${author} posted an announcement:`, excerpt],
          action: 'Read it on Darsi',
        },
        fr: {
          subject: title,
          paragraphs: [`${author} a publié une annonce :`, excerpt],
          action: 'Lire sur Darsi',
        },
      });
    }
    case 'admission.update': {
      const { subject, body } = data.params;
      return {
        subject,
        paragraphs: body
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean),
        action: translate(locale, {
          en: 'See the application',
          fr: 'Voir la candidature',
        }),
      };
    }
    case 'report.published': {
      const { student, term } = data.params;
      return translate(locale, {
        en: {
          subject: `${student}’s report for ${term}`,
          paragraphs: [`${student}’s progress report for ${term} is ready.`],
          action: 'Open the report',
        },
        fr: {
          subject: `Bulletin de ${student} : ${term}`,
          paragraphs: [
            `Le bulletin de ${student} pour ${term} est disponible.`,
          ],
          action: 'Ouvrir le bulletin',
        },
      });
    }
    case 'invoice.reminder': {
      const { number, amount, dueDate, overdue } = data.params;
      return translate(locale, {
        en: {
          subject: overdue
            ? `Invoice ${number} is overdue`
            : `Invoice ${number} is due on ${dueDate}`,
          paragraphs: [
            overdue
              ? `Invoice ${number} was due on ${dueDate}. ${amount} is still to pay.`
              : `This is a reminder that invoice ${number} is due on ${dueDate}. ${amount} is still to pay.`,
            'If you have already paid, please ignore this message.',
          ],
          action: 'See invoices',
        },
        fr: {
          subject: overdue
            ? `La facture ${number} est en retard`
            : `La facture ${number} est à régler le ${dueDate}`,
          paragraphs: [
            overdue
              ? `La facture ${number} était à régler le ${dueDate}. Il reste ${amount} à payer.`
              : `Pour rappel, la facture ${number} est à régler le ${dueDate}. Il reste ${amount} à payer.`,
            'Si vous avez déjà payé, ne tenez pas compte de ce message.',
          ],
          action: 'Voir les factures',
        },
      });
    }
    case 'payment.received': {
      const { receipt, amount } = data.params;
      return translate(locale, {
        en: {
          subject: `Payment received: ${amount}`,
          paragraphs: [
            `Thank you. We received ${amount}. Your receipt is ${receipt}.`,
          ],
          action: 'See the receipt',
        },
        fr: {
          subject: `Paiement reçu : ${amount}`,
          paragraphs: [
            `Merci. Nous avons bien reçu ${amount}. Votre reçu porte le numéro ${receipt}.`,
          ],
          action: 'Voir le reçu',
        },
      });
    }
    case 'grade.published': {
      const { assessment } = data.params;
      return translate(locale, {
        en: {
          subject: `New grade: ${assessment}`,
          paragraphs: [`A grade for “${assessment}” has been published.`],
          action: 'See grades',
        },
        fr: {
          subject: `Nouvelle note : ${assessment}`,
          paragraphs: [`Une note pour « ${assessment} » a été publiée.`],
          action: 'Voir les notes',
        },
      });
    }
  }
}

/** One mail for every in-app notice that is also sent by email, in the reader's language. */
@Injectable()
export class NoticeMail implements Mailable<NoticeData> {
  render(data: NoticeData, { locale }: MailRenderContext) {
    const copy = copyFor(data, locale);
    return {
      subject: copy.subject,
      template: 'notice',
      context: {
        greeting: translate(locale, { en: 'Hello,', fr: 'Bonjour,' }),
        paragraphs: copy.paragraphs,
        ...actionContext(locale, data.url, {
          en: copy.action,
          fr: copy.action,
        }),
      },
    };
  }
}
