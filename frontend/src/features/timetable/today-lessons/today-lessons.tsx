"use client";

import { useQuery } from "@tanstack/react-query";
import { SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { timeIn, todayIn } from "@/common/lib/calendar-date";
import { cn } from "@/common/lib/styles";
import { Link } from "@/common/i18n/navigation";
import { getAttendanceSettingsQueryOptions } from "@/common/integrations/tanstack-query/query-options/attendance";
import { getLessonsQueryOptions } from "@/common/integrations/tanstack-query/query-options/timetables";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/** The signed-in teacher's or student's lessons today, with the current one marked. */
export function TodayLessons() {
  const t = useTranslations("timetable");
  const tToday = useTranslations("today");
  const school = useCurrentSchool();
  const hasLessons = useHasRole("teacher", "teaching_assistant", "class_member", "student");
  const canTakeAttendance = useHasRole("teacher", "teaching_assistant");
  const tAttendance = useTranslations("attendance");
  const attendance = useQuery({ ...getAttendanceSettingsQueryOptions(), enabled: canTakeAttendance });
  const perPeriod = attendance.data?.mode === "period";
  const today = todayIn(school.timeZone);
  const lessons = useQuery({ ...getLessonsQueryOptions(today, today), enabled: hasLessons });
  const now = timeIn(school.timeZone);

  if (!hasLessons || (lessons.isSuccess && lessons.data.length === 0) || lessons.isError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SunIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{hasLessons ? t("noLessonsToday") : tToday("emptyTitle")}</EmptyTitle>
          {!hasLessons && <EmptyDescription>{tToday("emptyDescription")}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <section aria-labelledby="today-lessons" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="today-lessons" className="text-base font-semibold tracking-tight">
          {t("todayTitle")}
        </h2>
        <Link href="/timetable" className="text-primary text-sm font-medium hover:underline">
          {t("openTimetable")}
        </Link>
      </div>
      {lessons.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ol className="bg-card divide-y rounded-lg border">
          {lessons.data.map((lesson) => {
            const current = lesson.period.startsAt <= now && now < lesson.period.endsAt;
            const past = lesson.period.endsAt <= now;
            return (
              <li
                key={lesson.slotId}
                aria-current={current ? "time" : undefined}
                className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3", current && "bg-primary/5")}
              >
                <span className={cn("w-28 shrink-0 text-sm tabular-nums", past ? "text-muted-foreground" : "")}>
                  {lesson.period.startsAt}–{lesson.period.endsAt}
                </span>
                <span className={cn("min-w-0 flex-1 font-medium", past && "text-muted-foreground")}>
                  {lesson.class.name}
                </span>
                {lesson.room && <span className="text-muted-foreground text-sm">{t("room", { room: lesson.room })}</span>}
                {current && <span className="text-primary text-sm font-semibold">{t("now")}</span>}
                {canTakeAttendance && (
                  <Link
                    href={`/attendance/classes/${lesson.class.id}?date=${today}${perPeriod ? `&periodId=${lesson.period.id}` : ""}`}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    {tAttendance("take")}
                    <span className="sr-only">: {lesson.class.name}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
