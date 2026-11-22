"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getStudentAttendanceQueryOptions } from "@/common/integrations/tanstack-query/query-options/attendance";
import { getStudentQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { addDays, todayIn } from "@/common/lib/calendar-date";
import { formatCalendarDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const VARIANT = { absent: "destructive", late: "warning", excused: "info", present: "success" } as const;

/** A student's attendance over the last 30 days, and a way for families to explain an absence (ATT-4/6). */
export function StudentAttendance({ studentId }: Readonly<{ studentId: string }>) {
  const t = useTranslations("attendance");
  const format = useFormatter();
  const locale = useLocale();
  const school = useCurrentSchool();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const today = todayIn(school.timeZone);
  const from = addDays(today, -30);
  const student = useQuery(getStudentQueryOptions(studentId));
  const summary = useQuery(getStudentAttendanceQueryOptions(studentId, from, today));
  const isStaff = useHasRole("admin", "coordinator", "teacher", "teaching_assistant");
  const classes = useQuery({ ...getClassesQueryOptions(), enabled: isStaff });
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const explain = useMutation({
    mutationFn: () => api.attendance.explain(studentId, { date, reason: reason.trim() }),
    onSuccess: () => {
      toast.success(t("student.sent"));
      setReason("");
      return queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
    },
  });
  const className = (classId: string) => classes.data?.find((entry) => entry.id === classId)?.name;
  const statusLabel = (status: string) =>
    t.has(`statuses.${status}` as "statuses.present") ? t(`statuses.${status}` as "statuses.present") : status;
  const name = student.data ? `${student.data.preferredName ?? student.data.firstName} ${student.data.lastName}` : "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("student.title")}
          {name && <span className="text-muted-foreground font-normal"> · {name}</span>}
        </h1>
        <p className="text-muted-foreground text-sm">{t("student.last30")}</p>
      </div>
      <FormAlert message={summary.error ? errorMessage(summary.error) : null} />
      {summary.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : summary.data ? (
        <>
          <section className="bg-card flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border p-4">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-sm">{t("student.rate")}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {summary.data.rate === null ? "—" : format.number(summary.data.rate, { style: "percent", maximumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-muted-foreground text-sm tabular-nums">
              {t("student.sessions", { count: summary.data.sessions })}
              {" · "}
              {t("student.counts", {
                present: summary.data.present,
                late: summary.data.late,
                absent: summary.data.absent,
                excused: summary.data.excused,
              })}
            </p>
          </section>
          <section aria-labelledby="exceptions-title" className="flex flex-col gap-2">
            <h2 id="exceptions-title" className="text-base font-semibold">
              {t("student.exceptions")}
            </h2>
            {summary.data.exceptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("student.noRecords")}</p>
            ) : (
              <ul className="bg-card divide-y rounded-lg border">
                {summary.data.exceptions.map((entry, index) => (
                  <li key={`${entry.date}-${entry.classId}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="w-36 text-sm tabular-nums">{formatCalendarDate(entry.date, locale)}</span>
                    <span className="min-w-0 flex-1 text-sm">{className(entry.classId) ?? ""}</span>
                    <Badge variant={VARIANT[entry.status as keyof typeof VARIANT] ?? "secondary"}>{statusLabel(entry.status)}</Badge>
                    {entry.reason && <span className="text-muted-foreground w-full text-sm">{entry.reason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <section aria-labelledby="explain-title" className="bg-card flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <h2 id="explain-title" className="text-base font-semibold">
            {t("student.explainTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("student.explainDescription")}</p>
        </div>
        <FormAlert message={explain.error ? errorMessage(explain.error) : null} />
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim()) explain.mutate();
          }}
        >
          <div className="flex w-full flex-col gap-1.5 sm:w-48">
            <Label htmlFor="absence-date">{t("student.date")}</Label>
            <Input id="absence-date" type="date" value={date} max={addDays(today, 30)} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="absence-reason">{t("student.reason")}</Label>
            <Textarea id="absence-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <Button type="submit" className="self-start" disabled={!reason.trim() || explain.isPending}>
            {t("student.submit")}
          </Button>
        </form>
      </section>
    </div>
  );
}
