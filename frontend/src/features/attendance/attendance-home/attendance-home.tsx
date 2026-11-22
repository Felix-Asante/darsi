"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getAttendanceSettingsQueryOptions } from "@/common/integrations/tanstack-query/query-options/attendance";
import { getLessonsQueryOptions } from "@/common/integrations/tanstack-query/query-options/timetables";
import { todayIn } from "@/common/lib/calendar-date";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Today's classes (daily mode) or today's lessons (per period), each opening its attendance sheet. */
export function AttendanceHome() {
  const t = useTranslations("attendance");
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const canReport = useHasRole("admin", "coordinator");
  const today = todayIn(school.timeZone);
  const settings = useQuery(getAttendanceSettingsQueryOptions());
  const perPeriod = settings.data?.mode === "period";
  const classes = useQuery({ ...getClassesQueryOptions({ mine: true }), enabled: settings.isSuccess && !perPeriod });
  const lessons = useQuery({ ...getLessonsQueryOptions(today, today), enabled: perPeriod });
  const entries = perPeriod
    ? (lessons.data ?? []).map((lesson) => ({
        key: lesson.slotId,
        title: lesson.class.name,
        detail: `${lesson.period.name} · ${lesson.period.startsAt}–${lesson.period.endsAt}`,
        href: `/attendance/classes/${lesson.class.id}?date=${today}&periodId=${lesson.period.id}`,
      }))
    : (classes.data ?? []).map((schoolClass) => ({
        key: schoolClass.id,
        title: schoolClass.name,
        detail: schoolClass.code,
        href: `/attendance/classes/${schoolClass.id}?date=${today}`,
      }));
  const pending = settings.isPending || (perPeriod ? lessons.isPending : classes.isPending);
  const error = settings.error ?? classes.error ?? lessons.error;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("pickClass")}</p>
        </div>
        {canReport && (
          <Button variant="outline" nativeButton={false} render={<Link href="/attendance/report" />}>
            {t("report")}
          </Button>
        )}
      </div>
      <FormAlert message={error ? errorMessage(error) : null} />
      {pending ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{perPeriod ? t("sheet.noLessons") : t("noClasses")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link href={entry.href} className="bg-card hover:border-primary/40 flex items-center gap-3 rounded-lg border p-4">
                <ClipboardCheckIcon aria-hidden className="text-muted-foreground size-5 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">{entry.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
