"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { type Control, Controller } from "react-hook-form";
import { ComboboxField, type ComboboxOption } from "@/components/form/combobox-field";
import { TextField } from "@/components/form/text-field";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SchoolSettingsValues } from "./school-settings.schema";

function useTimeZoneOptions(locale: string): ComboboxOption[] {
  return useMemo(() => {
    const now = new Date();
    return [...Intl.supportedValuesOf("timeZone"), "UTC"].map((zone) => {
      const offset =
        new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "shortOffset" })
          .formatToParts(now)
          .find((part) => part.type === "timeZoneName")?.value ?? "";
      return { value: zone, label: `${zone.replace(/_/g, " ")} (${offset})` };
    });
  }, [locale]);
}

function useCurrencyOptions(locale: string): ComboboxOption[] {
  return useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "currency" });
    return Intl.supportedValuesOf("currency").map((code) => ({ value: code, label: `${code} · ${names.of(code)}` }));
  }, [locale]);
}

export function SchoolSettingsFields({ control }: Readonly<{ control: Control<SchoolSettingsValues> }>) {
  const t = useTranslations("onboarding");
  const tLocale = useTranslations("locale");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const timeZones = useTimeZoneOptions(locale);
  const currencies = useCurrencyOptions(locale);
  const languages = { en: tLocale("en"), fr: tLocale("fr") };

  return (
    <FieldGroup>
      <TextField control={control} name="name" label={t("schoolName")} autoComplete="organization" />
      <Controller
        control={control}
        name="defaultLocale"
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="defaultLocale">{t("language")}</FieldLabel>
            <Select items={languages} value={field.value} onValueChange={(value) => field.onChange(value)}>
              <SelectTrigger id="defaultLocale" className="w-full" aria-describedby="defaultLocale-description">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(languages).map(([value, label]) => (
                  <SelectItem key={value} value={value} lang={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription id="defaultLocale-description">{t("languageHint")}</FieldDescription>
          </Field>
        )}
      />
      <ComboboxField
        control={control}
        name="timeZone"
        label={t("timeZone")}
        description={t("timeZoneHint")}
        options={timeZones}
        emptyText={tCommon("noResults")}
      />
      <ComboboxField
        control={control}
        name="currency"
        label={t("currency")}
        description={t("currencyHint")}
        options={currencies}
        emptyText={tCommon("noResults")}
      />
    </FieldGroup>
  );
}
