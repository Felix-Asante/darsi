"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineForm } from "../_shared/inline-form";
import { CreateScheduleDialog } from "./create-schedule-dialog";
import { useBellSchedules } from "./use-bell-schedules";

export function BellSchedules() {
  const t = useTranslations("timetableSettings");
  const errorMessage = useApiErrorMessage();
  const { schedules, divisions, createSchedule, deleteSchedule, createPeriod, deletePeriod } = useBellSchedules();
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const divisionName = (id: string | null) =>
    id ? (divisions.data?.find((division) => division.id === id)?.name ?? "") : t("wholeSchool");

  return (
    <section aria-labelledby="bells-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="bells-title" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>
        <CreateScheduleDialog
          divisions={(divisions.data ?? []).map((division) => ({ value: division.id, label: division.name }))}
          onCreate={(input) => createSchedule.mutateAsync(input)}
        />
      </div>
      <FormAlert message={schedules.error ? errorMessage(schedules.error) : null} />
      {schedules.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : schedules.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {(schedules.data ?? []).map((schedule) => (
            <li key={schedule.id} className="bg-card flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-semibold">
                    {schedule.name}
                    <span className="text-muted-foreground font-normal"> · {divisionName(schedule.divisionId)}</span>
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {schedule.rotationKind === "weekly"
                      ? t("summaryWeekly", { weeks: schedule.rotationLength, count: schedule.periods.length })
                      : t("summaryCycle", { days: schedule.rotationLength, count: schedule.periods.length })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteSchedule", { name: schedule.name })}
                  disabled={deleteSchedule.isPending}
                  onClick={() => deleteSchedule.mutate(schedule.id, { onError })}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
              {schedule.periods.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noPeriods")}</p>
              ) : (
                <ol className="divide-y rounded-md border">
                  {schedule.periods.map((period) => (
                    <li key={period.id} className="flex items-center gap-4 px-3 py-2 text-sm">
                      <span className="w-24 font-medium">{period.name}</span>
                      <span className="text-muted-foreground flex-1 tabular-nums">
                        {period.startsAt}–{period.endsAt}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("deletePeriod", { name: period.name })}
                        disabled={deletePeriod.isPending}
                        onClick={() => deletePeriod.mutate(period.id, { onError })}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
              <InlineForm
                id={`period-${schedule.id}`}
                submitLabel={t("addPeriod")}
                fields={[
                  { name: "name", label: t("periodName"), className: "flex w-full flex-col gap-1.5 sm:w-32" },
                  { name: "startsAt", label: t("startsAt"), type: "time", className: "flex w-full flex-col gap-1.5 sm:w-32" },
                  { name: "endsAt", label: t("endsAt"), type: "time", className: "flex w-full flex-col gap-1.5 sm:w-32" },
                ]}
                onSubmit={(values) =>
                  createPeriod.mutateAsync({
                    scheduleId: schedule.id,
                    name: values.name,
                    startsAt: values.startsAt,
                    endsAt: values.endsAt,
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
