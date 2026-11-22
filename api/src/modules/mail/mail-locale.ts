export const MAIL_LOCALES = ['en', 'fr'] as const;

export type MailLocale = (typeof MAIL_LOCALES)[number];

export function mailLocale(locale: string | undefined): MailLocale {
  const language = locale?.slice(0, 2).toLowerCase();
  return MAIL_LOCALES.find((supported) => supported === language) ?? 'en';
}

export function translate<T>(
  locale: string | undefined,
  copy: Record<MailLocale, T>,
): T {
  return copy[mailLocale(locale)];
}

const FALLBACK_TEXT = {
  en: 'If the button doesn’t work, copy this link into your browser:',
  fr: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
};

export function actionContext(
  locale: string | undefined,
  url: string,
  label: Record<MailLocale, string>,
) {
  return {
    actionUrl: url,
    actionLabel: translate(locale, label),
    fallbackText: translate(locale, FALLBACK_TEXT),
  };
}
