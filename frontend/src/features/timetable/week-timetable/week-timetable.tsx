"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { addDays, asUtcDate, eachDay, startOfWeek, timeIn, todayIn } from "@/common/lib/calendar-date";
import { cn } from "@/common/lib/styles";
import { getOwnStudentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { getLessonsQueryOptions } from "@/common/integrations/tanstack-query/query-options/timetables";
import type { Lesson } from "@/common/types/calendar";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function WeekTimetable() {
  const t = useTranslations("timetable");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const isGuardian = useHasRole("guardian");
  const hasOwnLessons = useHasRole("admin", "coordinator", "teacher", "teaching_assistant", "class_member", "student");
  const isFamily = isGuardian && !hasOwnLessons;
  const today = todayIn(school.timeZone);
  const [week, setWeek] = useState(startOfWeek(today));
  const children = useQuery({ ...getOwnStudentsQueryOptions(), enabled: isFamily });
  const [chosenChild, setChosenChild] = useState<string | null>(null);
  const childId = isFamily ? (chosenChild ?? children.data?.[0]?.id) : undefined;
  const from = week;
  const to = addDays(week, 6);
  const lessons = useQuery({ ...getLessonsQueryOptions(from, to, childId), enabled: !isFamily || Boolean(childId) });

  const days = eachDay(from, to);
  const byDay = new Map(days.map((day) => [day, (lessons.data ?? []).filter((lesson) => lesson.date === day)]));
  // Weekends only show when something happens on them.
  const shownDays = days.filter((day, index) => index < 5 || (byDay.get(day)?.length ?? 0) > 0);
  const now = timeIn(school.timeZone);
  const isNow = (lesson: Lesson) => lesson.date === today && lesson.period.startsAt <= now && now < lesson.period.endsAt;
  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const rangeLabel = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).formatRange(
    asUtcDate(from),
    asUtcDate(addDays(from, 4)),
  );
  const childItems = (children.data ?? []).map((child) => ({
    value: child.id,
    label: `${child.preferredName ?? child.firstName} ${child.lastName}`,
  }));
  const childName = childItems.find((item) => item.value === childId)?.label;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {childName ? t("studentDescription", { name: childName }) : t("description")}
        </p>
      </div>

      {isFamily && childItems.length > 1 && (
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <Label htmlFor="timetable-child">{t("child")}</Label>
          <Select items={childItems} value={childId ?? null} onValueChange={(value) => setChosenChild(value)}>
            <SelectTrigger id="timetable-child" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {childItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {isFamily && children.isSuccess && childItems.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("noChildren")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label={t("previousWeek")} onClick={() => setWeek(addDays(week, -7))}>
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={t("nextWeek")} onClick={() => setWeek(addDays(week, 7))}>
            <ChevronRightIcon aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeek(startOfWeek(today))}>
            {t("thisWeek")}
          </Button>
        </div>
        <h2 className="text-lg font-semibold tracking-tight tabular-nums" aria-live="polite">
          {rangeLabel}
        </h2>
      </div>

      <FormAlert message={lessons.error ? errorMessage(lessons.error) : null} />

      {lessons.isPending && (!isFamily || childId) ? (
        <Skeleton className="h-64 w-full" />
      ) : lessons.isSuccess && lessons.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noLessons")}</p>
      ) : (
        <div
          className="grid gap-3 md:grid-cols-[repeat(var(--days),minmax(0,1fr))]"
          style={{ "--days": shownDays.length } as React.CSSProperties}
          aria-busy={lessons.isFetching}
        >
          {shownDays.map((day) => (
            <section
              key={day}
              aria-label={dayFormat.format(asUtcDate(day))}
              className={cn("bg-card flex flex-col gap-2 rounded-lg border p-3", day === today && "border-primary/50")}
            >
              <h3 className={cn("text-sm font-semibold capitalize", day === today && "text-primary")}>
                {dayFormat.format(asUtcDate(day))}
              </h3>
              <ol className="flex flex-col gap-2">
                {(byDay.get(day) ?? []).map((lesson) => (
                  <li
                    key={`${lesson.slotId}-${lesson.date}`}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-sm",
                      isNow(lesson) && "border-primary bg-primary/5",
                    )}
                    aria-current={isNow(lesson) ? "time" : undefined}
                  >
                    <span className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
                      <span>
                        {lesson.period.name} · {lesson.period.startsAt}–{lesson.period.endsAt}
                      </span>
                      {isNow(lesson) && <span className="text-primary font-semibold">{t("now")}</span>}
                    </span>
                    <span className="font-medium">{lesson.class.name}</span>
                    {(lesson.room || lesson.teachers.length > 0) && (
                      <span className="text-muted-foreground text-xs">
                        {[lesson.room && t("room", { room: lesson.room }), lesson.teachers.join(", ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
