"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getAcademicYearsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getReEnrolmentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import type { ReEnrolmentEntry } from "@/common/types/admissions";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT = {
  pending: "warning",
  confirmed: "success",
  declined: "destructive",
  applied: "secondary",
} as const;

/** Families confirm each child's place next year; confirmed students move up when the year starts (ADMS-13). */
export function ReEnrolmentAdmin() {
  const t = useTranslations("admissions.reEnrolment");
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const years = useQuery(getAcademicYearsQueryOptions());
  const [yearId, setYearId] = useState("");
  const entries = useQuery(getReEnrolmentsQueryOptions(yearId));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all() });
  const start = useMutation({
    mutationFn: () => api.admissions.startReEnrolment(yearId),
    onSuccess: async (response) => {
      toast.success(t("started", { count: response.data.created }));
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const apply = useMutation({
    mutationFn: () => api.admissions.applyReEnrolment(yearId),
    onSuccess: async (response) => {
      toast.success(t("applied", { count: response.data.applied }));
      await refresh();
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all() });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const items = (years.data ?? []).map((year) => ({
    value: year.id,
    label: year.name,
  }));
  const counts = (entries.data ?? []).reduce<
    Record<ReEnrolmentEntry["status"], number>
  >((total, entry) => ({ ...total, [entry.status]: total[entry.status] + 1 }), {
    pending: 0,
    confirmed: 0,
    declined: 0,
    applied: 0,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-56">
          <Label htmlFor="re-enrolment-year">{t("year")}</Label>
          <Select
            items={items}
            value={yearId || null}
            onValueChange={(next) => next && setYearId(next)}
          >
            <SelectTrigger id="re-enrolment-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {yearId && (
          <>
            <Button disabled={start.isPending} onClick={() => start.mutate()}>
              {t("start")}
            </Button>
            <Button
              variant="outline"
              disabled={apply.isPending || counts.confirmed === 0}
              onClick={() => apply.mutate()}
            >
              {t("apply", { count: counts.confirmed })}
            </Button>
          </>
        )}
      </div>
      <FormAlert message={entries.error ? errorMessage(entries.error) : null} />
      {yearId && entries.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        (entries.data ?? []).length > 0 && (
          <>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
              {(Object.keys(counts) as ReEnrolmentEntry["status"][]).map(
                (status) => (
                  <li key={status}>
                    {t(`statuses.${status}`)}: {counts[status]}
                  </li>
                ),
              )}
            </ul>
            <div className="bg-card rounded-lg border">
              <Table label={t("title")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("student")}</TableHead>
                    <TableHead>{t("now")}</TableHead>
                    <TableHead>{t("next")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.data?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.student?.name}</TableCell>
                      <TableCell>
                        {entry.student?.gradeLevel?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {entry.nextGradeLevel?.name ?? t("leaving")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[entry.status]}>
                          {t(`statuses.${entry.status}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )
      )}
    </div>
  );
}
