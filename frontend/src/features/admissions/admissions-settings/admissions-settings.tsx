"use client";

import { useTranslations } from "next-intl";
import { Cycles } from "./cycles";
import { FormBuilder } from "./form-builder";
import { Stages } from "./stages";

export function AdmissionsSettings() {
  const t = useTranslations("admissions.settings");
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
      </div>
      <Cycles />
      <FormBuilder />
      <Stages />
    </div>
  );
}
