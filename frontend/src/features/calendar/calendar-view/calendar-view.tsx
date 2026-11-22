"use client";

import { ChevronLeftIcon, ChevronRightIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { asUtcDate, startOfMonth, todayIn } from "@/common/lib/calendar-date";
import type { CalendarItem } from "@/common/types/calendar";
import { cn } from "@/common/lib/styles";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddEventDialog } from "./add-event-dialog";
import { coversDay, useCalendar } from "./use-calendar";

type View = "month" | "agenda";

const KIND_VARIANT: Record<string, "info" | "warning" | "secondary" | "outline"> = {
  holiday: "info",
  closure: "secondary",
  exam: "warning",
  event: "outline",
};

const MAX_PER_DAY = 3;

export function CalendarView() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const canManage = useHasRole("admin", "coordinator");
  const today = todayIn(school.timeZone);
  const [month, setMonth] = useState(startOfMonth(today));
  const [view, setView] = useState<View>("month");
  const { weeks, items, createEvent, deleteEvent, previous, next } = useCalendar(month);

  const dateFormat = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  const monthTitle = dateFormat({ month: "long", year: "numeric" }).format(asUtcDate(month));
  const weekdayNames = weeks[0].map((day) => ({
    short: dateFormat({ weekday: "short" }).format(asUtcDate(day)),
    long: dateFormat({ weekday: "long" }).format(asUtcDate(day)),
  }));
  const kindLabel = (kind: string) =>
    t.has(`kinds.${kind}` as "kinds.event") ? t(`kinds.${kind}` as "kinds.event") : kind;
  const timeLabel = (item: CalendarItem) =>
    item.startTime ? `${item.startTime}–${item.endTime}` : t("allDay");

  const all = items.data ?? [];
  const inMonth = all.filter((item) => item.endsOn >= month && item.startsOn.slice(0, 7) <= month.slice(0, 7));
  const agendaDays = [...new Set(inMonth.map((item) => (item.startsOn < month ? month : item.startsOn)))].sort();

  const remove = (item: CalendarItem) =>
    item.eventId &&
    deleteEvent.mutate(item.eventId, {
      onSuccess: () => toast.success(t("deleted", { title: item.title })),
      onError: (error) => toast.error(errorMessage(error)),
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>
        {canManage && <AddEventDialog defaultDate={today} onCreate={(input) => createEvent.mutateAsync(input)} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label={t("previousMonth")} onClick={() => setMonth(previous)}>
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={t("nextMonth")} onClick={() => setMonth(next)}>
            <ChevronRightIcon aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(today))}>
            {t("today")}
          </Button>
        </div>
        <h2 className="text-lg font-semibold tracking-tight capitalize" aria-live="polite">
          {monthTitle}
        </h2>
        <div role="group" aria-label={t("views.label")} className="ms-auto flex rounded-md border p-0.5">
          {(["month", "agenda"] as const).map((option) => (
            <Button
              key={option}
              variant={view === option ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {t(`views.${option}`)}
            </Button>
          ))}
        </div>
      </div>

      <FormAlert message={items.error ? errorMessage(items.error) : null} />

      {view === "month" ? (
        <div className="bg-card overflow-hidden rounded-lg border" aria-busy={items.isFetching}>
          <div className="text-muted-foreground grid grid-cols-7 border-b text-center text-xs font-medium">
            {weekdayNames.map((name) => (
              <div key={name.long} className="py-2">
                <abbr title={name.long} className="no-underline">
                  {name.short}
                </abbr>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((day) => {
              const dayItems = all.filter((item) => coversDay(item, day));
              const outside = day.slice(0, 7) !== month.slice(0, 7);
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-16 flex-col gap-1 border-e border-b p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-e-0",
                    outside && "bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center self-end rounded-full text-xs tabular-nums",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                      outside && !isToday && "text-muted-foreground",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <span className="sr-only">{dateFormat({ dateStyle: "full" }).format(asUtcDate(day))}</span>
                    <span aria-hidden>{Number(day.slice(8))}</span>
                  </span>
                  <ul className="hidden flex-col gap-1 sm:flex">
                    {dayItems.slice(0, MAX_PER_DAY).map((item) => (
                      <li key={item.id}>
                        <Badge
                          variant={KIND_VARIANT[item.kind] ?? "outline"}
                          className="w-full justify-start truncate rounded-sm"
                          title={`${item.title} · ${timeLabel(item)}`}
                        >
                          {item.startTime && <span className="tabular-nums">{item.startTime}</span>}
                          <span className="truncate">{item.title}</span>
                        </Badge>
                      </li>
                    ))}
                    {dayItems.length > MAX_PER_DAY && (
                      <li className="text-muted-foreground px-1 text-xs">
                        {t("more", { count: dayItems.length - MAX_PER_DAY })}
                      </li>
                    )}
                  </ul>
                  {dayItems.length > 0 && (
                    <span role="img" className="flex justify-center gap-0.5 sm:hidden" aria-label={dayItems.map((item) => item.title).join(", ")}>
                      {dayItems.slice(0, MAX_PER_DAY).map((item) => (
                        <span key={item.id} className="bg-foreground/60 size-1.5 rounded-full" />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <section aria-label={t("views.agenda")} className={cn("flex flex-col gap-4", view === "month" && "sm:hidden")}>
        {items.isSuccess && agendaDays.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noItems")}</p>
        ) : (
          agendaDays.map((day) => (
            <div key={day} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold capitalize">
                {dateFormat({ weekday: "long", day: "numeric", month: "long" }).format(asUtcDate(day))}
              </h3>
              <ul className="bg-card divide-y rounded-lg border">
                {inMonth
                  .filter((item) => (item.startsOn < month ? month : item.startsOn) === day)
                  .map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className="text-muted-foreground w-28 shrink-0 text-sm tabular-nums">{timeLabel(item)}</span>
                      <span className="min-w-0 flex-1 font-medium">
                        {item.title}
                        {item.endsOn !== item.startsOn && (
                          <span className="text-muted-foreground font-normal tabular-nums">
                            {" · "}
                            {dateFormat({ day: "numeric", month: "short" }).formatRange(
                              asUtcDate(item.startsOn),
                              asUtcDate(item.endsOn),
                            )}
                          </span>
                        )}
                      </span>
                      {item.recurring && (
                        <RepeatIcon aria-label={t("recurring")} className="text-muted-foreground size-4" />
                      )}
                      <Badge variant={KIND_VARIANT[item.kind] ?? "outline"}>{kindLabel(item.kind)}</Badge>
                      {canManage && item.eventId && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("deleteLabel", { title: item.title })}
                          disabled={deleteEvent.isPending}
                          onClick={() => remove(item)}
                        >
                          <Trash2Icon aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
