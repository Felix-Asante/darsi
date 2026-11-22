/** A page of the web app in the reader's language: English has no prefix, French lives under /fr. */
export function appLink(
  appUrl: string,
  locale: string | null | undefined,
  path: string,
): string {
  const base = appUrl.replace(/\/+$/, '');
  const prefix = locale?.startsWith('fr') ? '/fr' : '';
  return `${base}${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}
