"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useHasRole } from "@/common/auth/me-context";
import { BillingNav } from "./billing-nav";

/** Finance pages: the section tabs, or a plain refusal for anyone else. */
export function FinanceOnly({ children }: Readonly<{ children: ReactNode }>) {
  const t = useTranslations("billing");
  const allowed = useHasRole("admin", "finance_officer");
  if (!allowed)
    return <p className="text-muted-foreground text-sm">{t("financeOnly")}</p>;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <BillingNav />
      {children}
    </div>
  );
}
