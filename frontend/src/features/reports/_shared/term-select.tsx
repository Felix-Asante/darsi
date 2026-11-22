"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useCurrentSchool } from "@/common/auth/me-context";
import { getCurrentYearQueryOptions, getTermsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { todayIn } from "@/common/lib/calendar-date";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The current year's terms, starting on the term in progress. */
export function TermSelect({ value, onChange }: Readonly<{ value: string; onChange: (termId: string) => void }>) {
  const t = useTranslations("reports");
  const school = useCurrentSchool();
  const year = useQuery(getCurrentYearQueryOptions());
  const terms = useQuery({ ...getTermsQueryOptions(year.data?.id ?? ""), enabled: Boolean(year.data) });
  const items = (terms.data ?? []).map((term) => ({ value: term.id, label: term.name }));

  useEffect(() => {
    if (value || !terms.data?.length) return;
    const today = todayIn(school.timeZone);
    onChange((terms.data.find((term) => term.startsOn <= today && term.endsOn >= today) ?? terms.data[0]).id);
  }, [value, terms.data, school.timeZone, onChange]);

  if (terms.isSuccess && items.length === 0) return <p className="text-muted-foreground text-sm">{t("noTerms")}</p>;
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-56">
      <Label htmlFor="report-term">{t("term")}</Label>
      <Select items={items} value={value || null} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id="report-term" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
