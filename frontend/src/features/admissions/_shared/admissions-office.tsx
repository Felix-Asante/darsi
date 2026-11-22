"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useHasRole } from "@/common/auth/me-context";
import { AdmissionsNav } from "./admissions-nav";

/** Staff pages: the section tabs, or a plain refusal for anyone else. */
export function AdmissionsOffice({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = useTranslations("admissions");
  const allowed = useHasRole(
    "admin",
    "admissions_officer",
    "coordinator",
    "finance_officer",
  );
  if (!allowed)
    return <p className="text-muted-foreground text-sm">{t("staffOnly")}</p>;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdmissionsNav />
      {children}
    </div>
  );
}
