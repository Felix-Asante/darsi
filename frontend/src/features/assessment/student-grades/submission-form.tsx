"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SubmissionForm({ assessmentId, initial }: Readonly<{ assessmentId: string; initial: string }>) {
  const t = useTranslations("assessment.grades");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [body, setBody] = useState(initial);
  const submit = useMutation({
    mutationFn: () => api.assessment.submit(assessmentId, body.trim()),
    onSuccess: () => {
      toast.success(t("handedIn"));
      return queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all() });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const id = `submission-${assessmentId}`;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) submit.mutate();
      }}
    >
      <Label htmlFor={id}>{t("submission")}</Label>
      <Textarea id={id} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      <Button type="submit" size="sm" className="self-start" disabled={!body.trim() || submit.isPending}>
        {initial ? t("update") : t("submit")}
      </Button>
    </form>
  );
}
