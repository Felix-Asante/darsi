"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getReportCardQueryOptions } from "@/common/integrations/tanstack-query/query-options/reports";
import { api } from "@/common/service/api";
import type { ReportCardDetail } from "@/common/types/portfolio";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ReportStatusBadge } from "../_shared/status-badge";

const EDITABLE = ["draft", "returned"];

function CardView({ card }: Readonly<{ card: ReportCardDetail }>) {
  const t = useTranslations("reports");
  const format = useFormatter();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [general, setGeneral] = useState(card.generalComment ?? "");
  const [note, setNote] = useState("");
  const editable = EDITABLE.includes(card.status);
  const store = async (response: { data: ReportCardDetail }) => {
    queryClient.setQueryData(queryKeys.reports.card(card.id), response.data);
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.all(), refetchType: "none" });
  };
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const saveGeneral = useMutation({ mutationFn: () => api.reports.setGeneralComment(card.id, general || null), onSuccess: store, onError });
  const sendBack = useMutation({
    mutationFn: () => api.reports.returnForEdits(card.id, note.trim()),
    onSuccess: async (response) => {
      toast.success(t("review.returnedToast"));
      await store(response);
    },
    onError,
  });
  const approve = useMutation({
    mutationFn: () => api.reports.approve(card.id),
    onSuccess: async (response) => {
      toast.success(t("review.approvedToast"));
      await store(response);
    },
    onError,
  });
  const download = useMutation({
    mutationFn: () => api.files.download(card.fileId!).then((response) => response.data),
    onSuccess: (file) => window.location.assign(file.url),
    onError,
  });
  const name = `${card.student.preferredName ?? card.student.firstName} ${card.student.lastName}`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link href="/reports/review" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("review.back")}
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        <span className="text-muted-foreground text-sm">{card.term.name}</span>
        <ReportStatusBadge status={card.status} />
        {card.fileId && (
          <Button variant="outline" size="sm" className="ms-auto" disabled={download.isPending} onClick={() => download.mutate()}>
            <DownloadIcon aria-hidden />
            {t("review.download")}
          </Button>
        )}
      </header>
      {card.returnNote && card.status === "returned" && (
        <p className="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm">{t("returned", { note: card.returnNote })}</p>
      )}
      <ul className="bg-card divide-y rounded-lg border">
        {card.entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 p-4">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{entry.subjectName}</span>
              <span className="font-semibold tabular-nums">
                {entry.resultValue ?? "—"}
                {entry.reportingScaleName && <span className="text-muted-foreground font-normal"> · {entry.reportingScaleName}</span>}
              </span>
            </div>
            <p className="text-sm whitespace-pre-line">{entry.comment ?? "—"}</p>
          </li>
        ))}
      </ul>
      {card.attendance && (
        <p className="text-muted-foreground text-sm tabular-nums">
          {t("review.attendance", {
            rate: card.attendance.rate === null ? "—" : format.number(card.attendance.rate, { style: "percent", maximumFractionDigits: 0 }),
            absent: card.attendance.absent,
            late: card.attendance.late,
          })}
        </p>
      )}
      <section className="flex flex-col gap-2">
        <Label htmlFor="general-comment">{t("review.general")}</Label>
        <Textarea id="general-comment" rows={3} disabled={!editable} value={general} onChange={(event) => setGeneral(event.target.value)} />
        {editable && (
          <Button variant="secondary" size="sm" className="self-start" disabled={saveGeneral.isPending} onClick={() => saveGeneral.mutate()}>
            {t("review.saveGeneral")}
          </Button>
        )}
      </section>
      {editable && (
        <section className="bg-card flex flex-col gap-3 rounded-lg border p-4">
          <Label htmlFor="return-note">{t("review.returnNote")}</Label>
          <Textarea id="return-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!note.trim() || sendBack.isPending} onClick={() => sendBack.mutate()}>
              {t("review.return")}
            </Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
              {t("review.approve")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export function ReportCard({ cardId }: Readonly<{ cardId: string }>) {
  const errorMessage = useApiErrorMessage();
  const card = useQuery(getReportCardQueryOptions(cardId));
  if (card.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-4xl" />;
  if (card.isError) return <FormAlert message={errorMessage(card.error)} />;
  return <CardView key={card.dataUpdatedAt} card={card.data} />;
}
