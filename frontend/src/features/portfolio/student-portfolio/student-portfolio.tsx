"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getPortfolioItemsQueryOptions,
  getPortfolioOverviewQueryOptions,
  getPortfolioSettingsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/portfolio";
import { asUtcDate, eachDay } from "@/common/lib/calendar-date";
import { formatDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import { FileOpener } from "@/components/files/file-opener";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddItemDialog } from "../_shared/add-item-dialog";
import { ItemCard } from "../_shared/item-card";

function Card({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Everything about a student on one page, read live from each module (PRT-1). Fees never appear. */
export function StudentPortfolio({ studentId }: Readonly<{ studentId: string }>) {
  const t = useTranslations("portfolio");
  const format = useFormatter();
  const locale = useLocale();
  const school = useCurrentSchool();
  const errorMessage = useApiErrorMessage();
  const isStaff = useHasRole("admin", "coordinator", "teacher", "teaching_assistant");
  // The API shows a student only their own portfolio, so the role is enough here.
  const isSelf = useHasRole("student") && !isStaff;
  const overview = useQuery(getPortfolioOverviewQueryOptions(studentId));
  const items = useInfiniteQuery(getPortfolioItemsQueryOptions(studentId));
  const settings = useQuery(getPortfolioSettingsQueryOptions());
  const openReport = useMutation({
    mutationFn: (fileId: string) => api.files.download(fileId).then((response) => response.data),
    onSuccess: (download) => window.location.assign(download.url),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (overview.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-6xl" />;
  if (overview.isError) return <FormAlert message={errorMessage(overview.error)} />;
  const data = overview.data;
  const name = `${data.student.preferredName ?? data.student.firstName} ${data.student.lastName}`;
  const canAdd = isStaff || isSelf;
  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" });
  const allItems = items.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
          <p className="text-muted-foreground text-sm">
            {t("title")}
            {data.student.gradeLevel && ` · ${data.student.gradeLevel.name}`}
            {data.term && ` · ${data.term.name}`}
          </p>
        </div>
        {canAdd && <AddItemDialog owner={{ studentId }} showPendingNote={!isStaff && (settings.data?.approvalRequired ?? true)} />}
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title={t("thisWeek")}>
          {data.week.lessons.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noLessons")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {eachDay(data.week.from, data.week.to)
                .filter((day) => data.week.lessons.some((lesson) => lesson.date === day))
                .map((day) => (
                  <li key={day} className="flex gap-2">
                    <span className="text-muted-foreground w-16 shrink-0 capitalize">{dayFormat.format(asUtcDate(day))}</span>
                    <span className="min-w-0">
                      {data.week.lessons
                        .filter((lesson) => lesson.date === day)
                        .map((lesson) => `${lesson.period.startsAt} ${lesson.class.name}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title={t("attendance")}>
          {data.attendance ? (
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-semibold tabular-nums">
                {data.attendance.rate === null ? "—" : format.number(data.attendance.rate, { style: "percent", maximumFractionDigits: 0 })}
              </span>
              <span className="text-muted-foreground text-sm">
                {t("attendanceDetail", { absent: data.attendance.absent, late: data.attendance.late })}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noTerm")}</p>
          )}
        </Card>

        <Card title={t("reports")}>
          {data.reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noReports")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.reports.map((report) => (
                <li key={report.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {report.term}
                    <span className="text-muted-foreground"> · {formatDate(report.publishedAt, locale, school.timeZone)}</span>
                  </span>
                  {report.fileId && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t("reports")}: ${report.term}`}
                      onClick={() => openReport.mutate(report.fileId!)}
                    >
                      <DownloadIcon aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("grades")}>
          {data.grades.every((entry) => entry.result.mastery === null && !entry.latest) ? (
            <p className="text-muted-foreground text-sm">{t("noGrades")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.grades.map((entry) => (
                <li key={entry.class.id} className="flex flex-col py-1.5 first:pt-0 last:pb-0">
                  <span className="flex justify-between gap-2">
                    <span className="font-medium">{entry.class.subject?.name ?? entry.class.name}</span>
                    <span className="font-semibold tabular-nums">
                      {entry.result.value ??
                        (entry.result.mastery === null ? "—" : format.number(entry.result.mastery, { style: "percent", maximumFractionDigits: 0 }))}
                    </span>
                  </span>
                  {entry.latest?.value && (
                    <span className="text-muted-foreground text-xs">{t("latest", { title: entry.latest.title, value: entry.latest.value })}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("files")}>
          {data.files.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noItems")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.files.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                  <FileOpener file={entry.file} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="portfolio-work" className="flex flex-col gap-3">
        <h2 id="portfolio-work" className="text-lg font-semibold tracking-tight">
          {t("work")}
        </h2>
        <FormAlert message={items.error ? errorMessage(items.error) : null} />
        {items.isSuccess && allItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noItems")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {allItems.map((item) => (
              <ItemCard key={item.id} item={item} isStaff={isStaff} canDiscuss={isStaff || isSelf} />
            ))}
          </div>
        )}
        {items.hasNextPage && (
          <Button variant="outline" className="self-center" onClick={() => items.fetchNextPage()}>
            {t("loadMore")}
          </Button>
        )}
      </section>
    </div>
  );
}
