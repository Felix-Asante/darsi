"use client";

import { useLocale } from "next-intl";
import { useCurrentSchool } from "@/common/auth/me-context";
import { formatMoney } from "@/common/lib/format";

/** Formats minor units in the viewer's language and the school's (or the given) currency. */
export function useMoney() {
  const locale = useLocale();
  const school = useCurrentSchool();
  return (minor: string | bigint, currency: string = school.currency) =>
    formatMoney(minor, currency, locale);
}
