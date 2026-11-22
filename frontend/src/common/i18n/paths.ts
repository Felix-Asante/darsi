import { routing } from "./routing";

/** An absolute app path in a locale: English has no prefix, other locales do. */
export function localizedPath(locale: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return locale === routing.defaultLocale
    ? normalized
    : `/${locale}${normalized === "/" ? "" : normalized}`;
}

/** Only same-site paths are followed after sign-in, so a crafted link can't send users elsewhere. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
