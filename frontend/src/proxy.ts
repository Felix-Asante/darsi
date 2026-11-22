import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { localizedPath } from "@/common/i18n/paths";
import { routing } from "@/common/i18n/routing";

const intl = createMiddleware(routing);

const PUBLIC_PATHS = [
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/apply",
];
const SESSION_COOKIES = ["darsi.session_token", "__Secure-darsi.session_token"];

function splitLocale(pathname: string) {
  const locale = routing.locales.find(
    (candidate) =>
      pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`),
  );
  if (!locale) return { locale: routing.defaultLocale, path: pathname };
  return { locale, path: pathname.slice(locale.length + 1) || "/" };
}

/**
 * Locale routing, plus a fast redirect to sign-in when there is no session cookie at all.
 * The cookie's validity is checked by the API on the first request.
 */
export default function proxy(request: NextRequest) {
  const { locale, path } = splitLocale(request.nextUrl.pathname);
  const isPublic = PUBLIC_PATHS.some(
    (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`),
  );
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!isPublic && !hasSession) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = localizedPath(locale, "/sign-in");
    signIn.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(signIn);
  }

  return intl(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
