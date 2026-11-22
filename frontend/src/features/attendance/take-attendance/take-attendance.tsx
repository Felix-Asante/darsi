"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getAttendanceSheetQueryOptions } from "@/common/integrations/tanstack-query/query-options/attendance";
import { formatCalendarDate } from "@/common/lib/format";
import { cn } from "@/common/lib/styles";
import { api } from "@/common/service/api";
import type { AttendanceSheet, AttendanceStatus } from "@/common/types/daily";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const TONE: Record<AttendanceStatus["countsAs"], string> = {
  present: "peer-checked:bg-success peer-checked:text-success-foreground",
  absent: "peer-checked:bg-destructive peer-checked:text-destructive-foreground",
  late: "peer-checked:bg-warning peer-checked:text-warning-foreground",
  excused: "peer-checked:bg-info peer-checked:text-info-foreground",
};

interface Entry {
  status: string;
  reason: string;
}

export function TakeAttendance({ classId, date, periodId }: Readonly<{ classId: string; date: string; periodId?: string }>) {
  const errorMessage = useApiErrorMessage();
  const sheet = useQuery(getAttendanceSheetQueryOptions(classId, date, periodId));
  if (sheet.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-4xl" />;
  if (sheet.isError) return <FormAlert message={errorMessage(sheet.error)} />;
  return <AttendanceEditor key={sheet.dataUpdatedAt} classId={classId} sheet={sheet.data} />;
}

function AttendanceEditor({ classId, sheet }: Readonly<{ classId: string; sheet: AttendanceSheet }>) {
  const t = useTranslations("attendance");
  const locale = useLocale();
  const format = useFormatter();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(sheet.students.map(({ student, status, reason }) => [student.id, { status, reason: reason ?? "" }])),
  );
  const [error, setError] = useState<string | null>(null);
  const countsAs = (code: string) => sheet.statuses.find((status) => status.code === code)?.countsAs ?? "present";
  const label = (status: AttendanceStatus) => status.label ?? t(`statuses.${status.countsAs}`);
  const absent = Object.values(entries).filter((entry) => countsAs(entry.status) === "absent").length;
  const late = Object.values(entries).filter((entry) => countsAs(entry.status) === "late").length;

  const save = useMutation({
    mutationFn: () =>
      api.attendance.take(classId, {
        date: sheet.date,
        periodId: sheet.periodId,
        records: Object.entries(entries)
          .filter(([, entry]) => entry.status !== "present" || entry.reason.trim())
          .map(([studentId, entry]) => ({ studentId, status: entry.status, reason: entry.reason.trim() || null })),
      }),
    onSuccess: async (response) => {
      toast.success(t("sheet.saved"));
      queryClient.setQueryData(queryKeys.attendance.sheet(classId, sheet.date, sheet.periodId ?? undefined), response.data);
      await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all(), refetchType: "none" });
    },
    onError: (saveError) => setError(errorMessage(saveError)),
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link href="/attendance" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("sheet.back")}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm capitalize">{formatCalendarDate(sheet.date, locale, "long")}</p>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </header>

      {sheet.dayOff ? (
        <p className="bg-info/10 text-info rounded-md px-3 py-2 text-sm">{t("sheet.dayOff")}</p>
      ) : (
        <>
          {sheet.closed && <p className="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm">{t("sheet.closedNote")}</p>}
          <FormAlert message={error} />
          {sheet.students.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("sheet.noStudents")}</p>
          ) : (
            <ul className="bg-card divide-y rounded-lg border">
              {sheet.students.map(({ student, reasonSource }) => {
                const entry = entries[student.id];
                const name = `${student.preferredName ?? student.firstName} ${student.lastName}`;
                const update = (patch: Partial<Entry>) =>
                  setEntries((current) => ({ ...current, [student.id]: { ...current[student.id], ...patch } }));
                return (
                  <li key={student.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="min-w-0 flex-1 font-medium">
                      {student.lastName}, {student.preferredName ?? student.firstName}
                    </span>
                    <fieldset className="flex flex-wrap gap-1">
                      <legend className="sr-only">{t("sheet.status", { name })}</legend>
                      {sheet.statuses.map((status) => {
                        const id = `${student.id}-${status.code}`;
                        return (
                          <span key={status.code} className="relative">
                            <input
                              type="radio"
                              id={id}
                              name={`status-${student.id}`}
                              value={status.code}
                              checked={entry.status === status.code}
                              onChange={() => update({ status: status.code })}
                              className="peer sr-only"
                            />
                            <label
                              htmlFor={id}
                              className={cn(
                                "peer-focus-visible:ring-ring/50 inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-sm peer-focus-visible:ring-3",
                                TONE[status.countsAs],
                              )}
                            >
                              {label(status)}
                            </label>
                          </span>
                        );
                      })}
                    </fieldset>
                    {countsAs(entry.status) !== "present" && (
                      <div className="flex flex-col gap-0.5 sm:w-48">
                        <Input
                          aria-label={t("sheet.reasonFor", { name })}
                          placeholder={t("sheet.reason")}
                          value={entry.reason}
                          onChange={(event) => update({ reason: event.target.value })}
                        />
                        {reasonSource === "guardian" && (
                          <span className="text-muted-foreground text-xs">{t("sheet.guardianReason")}</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={save.isPending || sheet.students.length === 0} onClick={() => save.mutate()}>
              {t("sheet.save")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setEntries((current) =>
                  Object.fromEntries(Object.keys(current).map((studentId) => [studentId, { status: "present", reason: "" }])),
                )
              }
            >
              {t("sheet.allPresent")}
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
              {t("sheet.summary", { absent, late })}
            </span>
            {sheet.taken && (
              <span className="text-muted-foreground text-sm">
                {t("sheet.lastTaken", { time: format.relativeTime(new Date(sheet.taken.at)) })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
