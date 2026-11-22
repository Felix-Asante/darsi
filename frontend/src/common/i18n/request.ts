import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: requested }) => {
  const candidate = requested ?? (await rootLocale());
  const locale = hasLocale(routing.locales, candidate)
    ? candidate
    : routing.defaultLocale;

  return {
    locale,
    // A fixed default keeps server and client output identical; school dates pass the school's zone explicitly.
    timeZone: "UTC",
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
