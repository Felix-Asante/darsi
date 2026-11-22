"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassSlotsQueryOptions } from "@/common/integrations/tanstack-query/query-options/timetables";
import { api } from "@/common/service/api";
import type { BellSchedule } from "@/common/types/calendar";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/** "Week B · Tuesday", "Monday" or "Day 4", from a slot's place in the rotation. */
function useCycleDayLabel(schedule: BellSchedule | null) {
  const t = useTranslations("timetable");
  const locale = useLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  // 2024-01-01 was a Monday, so day N of that week has ISO weekday N.
  const nameOf = (isoDay: number) => weekday.format(new Date(Date.UTC(2024, 0, isoDay)));
  return (cycleDay: number) => {
    if (!schedule || schedule.rotationKind === "cycle") return t("day", { day: cycleDay });
    const perWeek = schedule.weekdays.length;
    const day = nameOf(schedule.weekdays[(cycleDay - 1) % perWeek]);
    if (schedule.rotationLength === 1) return day;
    return `${t("week", { week: String.fromCharCode(65 + Math.floor((cycleDay - 1) / perWeek)) })} · ${day}`;
  };
}

export function ClassTimetable({ classId, canManage }: Readonly<{ classId: string; canManage: boolean }>) {
  const t = useTranslations("classes.slots");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const timetable = useQuery(getClassSlotsQueryOptions(classId));
  const schedule = timetable.data?.schedule ?? null;
  const slots = timetable.data?.slots ?? [];
  const label = useCycleDayLabel(schedule);
  const [cycleDay, setCycleDay] = useState("1");
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.timetables.all() });
  const createSlot = useMutation({
    mutationFn: () =>
      api.timetables.createSlot(classId, { periodId: periodId!, cycleDay: Number(cycleDay), room: room.trim() || null }),
    onSuccess: () => {
      setRoom("");
      return refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const deleteSlot = useMutation({
    mutationFn: (slotId: string) => api.timetables.deleteSlot(classId, slotId),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const dayItems = Array.from({ length: schedule?.cycleLength ?? 0 }, (_, index) => ({
    value: String(index + 1),
    label: label(index + 1),
  }));
  const periodItems = (schedule?.periods ?? []).map((period) => ({
    value: period.id,
    label: `${period.name} · ${period.startsAt}–${period.endsAt}`,
  }));

  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5" aria-labelledby="class-timetable-title">
      <h2 id="class-timetable-title" className="text-base font-semibold tracking-tight">
        {t("title")}
      </h2>
      <FormAlert message={timetable.error ? errorMessage(timetable.error) : null} />
      {timetable.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : timetable.isError ? null : !schedule ? (
        <p className="text-muted-foreground text-sm">{t("noSchedule")}</p>
      ) : (
        <>
          {slots.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-y">
              {slots.map((slot) => (
                <li key={slot.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
                  <span className="min-w-40 font-medium">{label(slot.cycleDay)}</span>
                  <span className="text-muted-foreground flex-1 text-sm tabular-nums">
                    {slot.period.name} · {slot.period.startsAt}–{slot.period.endsAt}
                    {slot.room && ` · ${slot.room}`}
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("removeLabel", { day: label(slot.cycleDay), period: slot.period.name })}
                      disabled={deleteSlot.isPending}
                      onClick={() => deleteSlot.mutate(slot.id)}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && periodItems.length > 0 && (
            <form
              className="flex flex-wrap items-end gap-3 border-t pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (periodId) createSlot.mutate();
              }}
            >
              <div className="flex w-full flex-col gap-1.5 sm:w-48">
                <Label htmlFor="slot-day">{t("day")}</Label>
                <Select items={dayItems} value={cycleDay} onValueChange={(value) => value && setCycleDay(value)}>
                  <SelectTrigger id="slot-day" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-full flex-col gap-1.5 sm:w-52">
                <Label htmlFor="slot-period">{t("period")}</Label>
                <Select items={periodItems} value={periodId} onValueChange={(value) => setPeriodId(value)}>
                  <SelectTrigger id="slot-period" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-full flex-col gap-1.5 sm:w-28">
                <Label htmlFor="slot-room">{t("room")}</Label>
                <Input id="slot-room" value={room} autoComplete="off" onChange={(event) => setRoom(event.target.value)} />
              </div>
              <Button type="submit" variant="secondary" disabled={!periodId || createSlot.isPending}>
                {t("add")}
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
