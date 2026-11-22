"use client";

import { useMutation } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { api } from "@/common/service/api";
import { Button } from "@/components/ui/button";

/** Opens a handed-in file through a fresh download link. */
export function SubmissionFile({ fileId }: Readonly<{ fileId: string }>) {
  const t = useTranslations("files");
  const errorMessage = useApiErrorMessage();
  const open = useMutation({
    mutationFn: () => api.files.download(fileId).then((response) => response.data),
    onSuccess: (download) => window.location.assign(download.url),
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Button variant="outline" size="sm" className="self-start" disabled={open.isPending} onClick={() => open.mutate()}>
      <DownloadIcon aria-hidden />
      {t("downloadFile")}
    </Button>
  );
}
