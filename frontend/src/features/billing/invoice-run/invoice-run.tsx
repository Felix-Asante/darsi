"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getCurrentYearQueryOptions,
  getTermsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import type { RunPeriod, RunPreview } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Choice } from "../_shared/choice";
import { PageHeader } from "../_shared/page-header";
import { useMoney } from "../_shared/use-money";

type Schedule = RunPeriod["schedule"];

/** Invoice every family for a term, month or year: preview first, then issue (FEE-5). */
export function InvoiceRun() {
  const t = useTranslations("billing.runs");
  const tBilling = useTranslations("billing");
  const money = useMoney();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const year = useQuery(getCurrentYearQueryOptions());
  const terms = useQuery({
    ...getTermsQueryOptions(year.data?.id ?? ""),
    enabled: Boolean(year.data),
  });
  const [schedule, setSchedule] = useState<Schedule>("term");
  const [termId, setTermId] = useState("");
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<RunPreview | null>(null);

  const period = (): RunPeriod | null => {
    if (!year.data) return null;
    if (schedule === "term" && !termId) return null;
    if (schedule === "monthly" && !month) return null;
    return {
      academicYearId: year.data.id,
      schedule,
      ...(schedule === "term" ? { termId } : {}),
      ...(schedule === "monthly" ? { month } : {}),
      ...(dueDate ? { dueDate } : {}),
    };
  };

  const check = useMutation({
    mutationFn: () => api.billing.previewRun(period()!),
    onSuccess: (response) => setPreview(response.data),
  });
  const run = useMutation({
    mutationFn: () => api.billing.run(period()!),
    onSuccess: async (response) => {
      toast.success(
        t("done", {
          issued: response.data.issued,
          skipped: response.data.skipped,
        }),
      );
      setPreview(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const reset = () => setPreview(null);
  const toIssue =
    preview?.families.filter((family) => !family.alreadyInvoiced) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      {year.isSuccess && !year.data ? (
        <p className="text-muted-foreground text-sm">{t("noYear")}</p>
      ) : (
        <form
          className="bg-card flex flex-wrap items-end gap-4 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            check.mutate();
          }}
        >
          <Choice
            id="run-schedule"
            label={t("schedule")}
            value={schedule}
            onChange={(value) => {
              setSchedule(value);
              reset();
            }}
            items={(["term", "monthly", "annual"] as const).map((value) => ({
              value,
              label: tBilling(`schedules.${value}`),
            }))}
          />
          {schedule === "term" && (
            <Choice
              id="run-term"
              label={t("term")}
              value={termId}
              onChange={(value) => {
                setTermId(value);
                reset();
              }}
              items={(terms.data ?? []).map((term) => ({
                value: term.id,
                label: term.name,
              }))}
            />
          )}
          {schedule === "monthly" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="run-month">{t("month")}</Label>
              <Input
                id="run-month"
                type="month"
                className="w-44"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  reset();
                }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-due">{t("dueDate")}</Label>
            <Input
              id="run-due"
              type="date"
              className="w-44"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={!period() || check.isPending}
          >
            {t("preview")}
          </Button>
        </form>
      )}
      <FormAlert message={check.error ? errorMessage(check.error) : null} />

      {preview && (
        <section
          aria-labelledby="run-preview-title"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2
              id="run-preview-title"
              className="text-lg font-semibold tracking-tight"
            >
              {t("previewTitle", { families: toIssue.length })}
            </h2>
            <div className="flex items-center gap-4">
              <span className="font-semibold tabular-nums">
                {money(preview.total)}
              </span>
              <Button
                disabled={toIssue.length === 0 || run.isPending}
                onClick={() => run.mutate()}
              >
                {t("issue", { count: toIssue.length })}
              </Button>
            </div>
          </div>
          {preview.withoutFamily.length > 0 && (
            <p
              role="status"
              className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-sm"
            >
              {t("withoutFamily", { names: preview.withoutFamily.join(", ") })}
            </p>
          )}
          {preview.families.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("nothing")}</p>
          ) : (
            <div className="bg-card rounded-lg border">
              <Table label={t("previewTitle", { families: toIssue.length })}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tBilling("family")}</TableHead>
                    <TableHead className="text-end">{t("students")}</TableHead>
                    <TableHead className="text-end">{t("total")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("status")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.families.map((family) => (
                    <TableRow key={family.familyId}>
                      <TableCell>{family.familyName}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {family.students}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {money(family.total)}
                      </TableCell>
                      <TableCell>
                        {family.alreadyInvoiced && (
                          <Badge variant="secondary">
                            {t("alreadyInvoiced")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
