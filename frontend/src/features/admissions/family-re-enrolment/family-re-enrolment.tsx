"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getMyReEnrolmentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** A guardian confirms or declines each child's place next year (ADMS-13). */
export function FamilyReEnrolment() {
  const t = useTranslations("admissions.familyReEnrolment");
  const tStatus = useTranslations("admissions.reEnrolment.statuses");
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const entries = useQuery(getMyReEnrolmentsQueryOptions());
  const respond = useMutation({
    mutationFn: ({
      id,
      response,
    }: {
      id: string;
      response: "confirmed" | "declined";
    }) => api.admissions.respondReEnrolment(id, response),
    onSuccess: async (_, { response }) => {
      toast.success(t(response));
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.all(),
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
      </div>
      <FormAlert message={entries.error ? errorMessage(entries.error) : null} />
      {entries.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : entries.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.data?.map((entry) => (
            <li
              key={entry.id}
              className="bg-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border p-4"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{entry.student?.name}</span>
                <span className="text-muted-foreground text-sm">
                  {entry.nextGradeLevel
                    ? t("nextGrade", { grade: entry.nextGradeLevel.name })
                    : t("finalYear")}
                </span>
              </div>
              {entry.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({ id: entry.id, response: "confirmed" })
                    }
                  >
                    {t("confirm")}
                    <span className="sr-only"> {entry.student?.name}</span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({ id: entry.id, response: "declined" })
                    }
                  >
                    {t("decline")}
                    <span className="sr-only"> {entry.student?.name}</span>
                  </Button>
                </div>
              ) : (
                <Badge
                  variant={
                    entry.status === "declined" ? "destructive" : "success"
                  }
                >
                  {tStatus(entry.status)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
