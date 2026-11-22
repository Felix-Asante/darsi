"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getCurrentYearQueryOptions, getTermsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getGradebookQueryOptions } from "@/common/integrations/tanstack-query/query-options/assessment";
import { formatCalendarDate } from "@/common/lib/format";
import { cn } from "@/common/lib/styles";
import { FormAlert } from "@/components/form/form-alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const WHOLE_YEAR = "";

export function ClassGradebook({ classId }: Readonly<{ classId: string }>) {
  const t = useTranslations("assessment.gradebook");
  const tMethods = useTranslations("gradingSettings.methods");
  const tGrading = useTranslations("assessment.grading");
  const tList = useTranslations("assessment.list");
  const format = useFormatter();
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const year = useQuery(getCurrentYearQueryOptions());
  const terms = useQuery({ ...getTermsQueryOptions(year.data?.id ?? ""), enabled: Boolean(year.data) });
  const [termId, setTermId] = useState(WHOLE_YEAR);
  const book = useQuery(getGradebookQueryOptions(classId, termId || undefined));
  const termItems = [{ value: WHOLE_YEAR, label: t("wholeYear") }, ...(terms.data ?? []).map((term) => ({ value: term.id, label: term.name }))];

  const data = book.data;
  const grade = (assessmentId: string, studentId: string) =>
    data?.grades.find((entry) => entry.assessmentId === assessmentId && entry.studentId === studentId);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Link href={`/classes/${classId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeftIcon aria-hidden className="size-4" />
        {tGrading("back")}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("title")}
            {data && <span className="text-muted-foreground font-normal"> · {data.class.name}</span>}
          </h1>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
          {data && <p className="text-muted-foreground text-sm">{t("method", { method: tMethods(data.method) })}</p>}
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-56">
          <Label htmlFor="gradebook-term">{t("term")}</Label>
          <Select items={termItems} value={termId} onValueChange={(value) => setTermId(value ?? WHOLE_YEAR)}>
            <SelectTrigger id="gradebook-term" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {termItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormAlert message={book.error ? errorMessage(book.error) : null} />
      {book.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : data && data.assessments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : data ? (
        <div className="bg-card overflow-auto rounded-lg border" aria-busy={book.isFetching}>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{`${t("title")} · ${data.class.name}`}</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="bg-card sticky start-0 z-10 px-3 py-2 text-start font-medium">
                  <span className="sr-only">{tGrading("student")}</span>
                </th>
                {data.assessments.map((assessment) => (
                  <th key={assessment.id} scope="col" className="min-w-24 px-3 py-2 text-start align-bottom font-medium">
                    <Link href={`/assessments/${assessment.id}`} className="hover:underline">
                      {assessment.title}
                    </Link>
                    <span className="text-muted-foreground block text-xs font-normal tabular-nums">
                      {assessment.dueOn ? formatCalendarDate(assessment.dueOn, locale, "short") : ""}
                      {assessment.kind === "formative" && ` · ${tList("kinds.formative")}`}
                    </span>
                  </th>
                ))}
                <th scope="col" className="bg-muted/50 min-w-28 px-3 py-2 text-start align-bottom font-semibold">
                  {t("result")}
                  {data.reportingScale && (
                    <span className="text-muted-foreground block text-xs font-normal">{data.reportingScale.name}</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => {
                const result = data.results.find((entry) => entry.studentId === student.id);
                return (
                  <tr key={student.id} className="hover:bg-muted/30 border-b last:border-b-0">
                    <th scope="row" className="bg-card sticky start-0 z-10 px-3 py-2 text-start font-medium whitespace-nowrap">
                      <Link href={`/students/${student.id}`} className="hover:underline">
                        {student.lastName}, {student.preferredName ?? student.firstName}
                      </Link>
                    </th>
                    {data.assessments.map((assessment) => {
                      const entry = grade(assessment.id, student.id);
                      return (
                        <td
                          key={assessment.id}
                          className={cn("px-3 py-2 tabular-nums", entry?.status === "draft" && "text-info italic")}
                          title={entry?.status === "draft" ? t("draft") : undefined}
                        >
                          {entry?.excused ? tGrading("excused") : (entry?.value ?? "—")}
                          {entry?.status === "draft" && <span className="sr-only"> ({t("draft")})</span>}
                        </td>
                      );
                    })}
                    <td className="bg-muted/50 px-3 py-2 font-semibold tabular-nums">
                      {result?.mastery === null || result?.mastery === undefined
                        ? "—"
                        : (result.value ?? format.number(result.mastery, { style: "percent", maximumFractionDigits: 0 }))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
