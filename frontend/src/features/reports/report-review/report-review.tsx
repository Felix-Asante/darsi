"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getReportCardsQueryOptions } from "@/common/integrations/tanstack-query/query-options/reports";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportStatusBadge } from "../_shared/status-badge";
import { TermSelect } from "../_shared/term-select";

/** Coordinators and admins follow each report through review (RPT-4). */
export function ReportReview() {
  const t = useTranslations("reports.review");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const canOpen = useHasRole("admin");
  const [termId, setTermId] = useState("");
  const cards = useQuery(getReportCardsQueryOptions(termId));
  const open = useMutation({
    mutationFn: () => api.reports.open(termId, {}),
    onSuccess: async (response) => {
      toast.success(t("opened", { students: response.data.students }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <TermSelect value={termId} onChange={setTermId} />
        {canOpen && termId && (
          <Button variant="outline" disabled={open.isPending} onClick={() => open.mutate()}>
            {t("open")}
          </Button>
        )}
      </div>
      <FormAlert message={cards.error ? errorMessage(cards.error) : null} />
      {termId && cards.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : cards.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {(cards.data ?? []).map((card) => (
            <li key={card.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <Link href={`/reports/cards/${card.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                {card.student.lastName}, {card.student.preferredName ?? card.student.firstName}
              </Link>
              <span className="text-muted-foreground text-sm tabular-nums">
                {t("progress", { commented: card.commented, entries: card.entries })}
              </span>
              <ReportStatusBadge status={card.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
