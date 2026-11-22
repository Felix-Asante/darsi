"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getReportClassSheetQueryOptions } from "@/common/integrations/tanstack-query/query-options/reports";
import { api } from "@/common/service/api";
import type { ReportClassSheet } from "@/common/types/portfolio";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ReportStatusBadge } from "../_shared/status-badge";
import { TermSelect } from "../_shared/term-select";

const EDITABLE = ["draft", "returned"];

function CommentsEditor({ termId, classId, sheet }: Readonly<{ termId: string; classId: string; sheet: ReportClassSheet }>) {
  const t = useTranslations("reports");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(sheet.rows.map((row) => [row.student.id, row.comment ?? ""])),
  );
  const save = useMutation({
    mutationFn: () =>
      api.reports.saveComments(
        termId,
        classId,
        sheet.rows
          .filter((row) => EDITABLE.includes(row.status) && (comments[row.student.id] ?? "") !== (row.comment ?? ""))
          .map((row) => ({ studentId: row.student.id, comment: comments[row.student.id] || null })),
      ),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.reports.classSheet(termId, classId), response.data);
      toast.success(t("saved"));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (sheet.rows.length === 0) return <p className="text-muted-foreground text-sm">{t("notOpen")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <ul className="bg-card divide-y rounded-lg border">
        {sheet.rows.map((row) => {
          const name = `${row.student.preferredName ?? row.student.firstName} ${row.student.lastName}`;
          const editable = EDITABLE.includes(row.status);
          return (
            <li key={row.student.id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 font-medium">
                  {row.student.lastName}, {row.student.preferredName ?? row.student.firstName}
                </span>
                <span className="text-sm tabular-nums">
                  <span className="text-muted-foreground">{t("result")}: </span>
                  <span className="font-semibold">{row.result ?? "—"}</span>
                </span>
                <ReportStatusBadge status={row.status} />
              </div>
              {row.returnNote && <p className="bg-warning/10 text-warning rounded-md px-3 py-1.5 text-sm">{t("returned", { note: row.returnNote })}</p>}
              <Textarea
                aria-label={t("commentFor", { name })}
                rows={3}
                disabled={!editable}
                value={comments[row.student.id] ?? ""}
                onChange={(event) => setComments((current) => ({ ...current, [row.student.id]: event.target.value }))}
              />
            </li>
          );
        })}
      </ul>
      <Button className="self-start" disabled={save.isPending} onClick={() => save.mutate()}>
        {t("save")}
      </Button>
    </div>
  );
}

/** Teachers and assistants write a comment per student for their class (RPT-2). */
export function ReportComments() {
  const t = useTranslations("reports");
  const tReview = useTranslations("reports.review");
  const errorMessage = useApiErrorMessage();
  const canReview = useHasRole("admin", "coordinator");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const classes = useQuery(getClassesQueryOptions({ mine: true }));
  const classItems = (classes.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }));
  const chosenClass = classId || classItems[0]?.value || "";
  const sheet = useQuery(getReportClassSheetQueryOptions(termId, chosenClass));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>
        {canReview && (
          <Button variant="outline" nativeButton={false} render={<Link href="/reports/review" />}>
            {tReview("title")}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <TermSelect value={termId} onChange={setTermId} />
        {classItems.length > 0 && (
          <div className="flex w-full flex-col gap-1.5 sm:w-60">
            <Label htmlFor="report-class">{t("class")}</Label>
            <Select items={classItems} value={chosenClass} onValueChange={(value) => value && setClassId(value)}>
              <SelectTrigger id="report-class" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {classes.isSuccess && classItems.length === 0 && !canReview && <p className="text-muted-foreground text-sm">{t("noClasses")}</p>}
      <FormAlert message={sheet.error ? errorMessage(sheet.error) : null} />
      {termId && chosenClass && sheet.isPending && <Skeleton className="h-48 w-full" />}
      {sheet.data && (
        <CommentsEditor key={`${termId}-${chosenClass}-${sheet.dataUpdatedAt}`} termId={termId} classId={chosenClass} sheet={sheet.data} />
      )}
    </div>
  );
}
