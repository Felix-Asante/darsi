"use client";

import { useMutation } from "@tanstack/react-query";
import { DownloadIcon, EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { api } from "@/common/service/api";
import type { Download, StoredFile } from "@/common/types/files";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Opens a file through a fresh, 60-second link from the API. Images, PDFs,
 * video and audio preview in the page (DRV-6); everything else downloads.
 */
export function FileOpener({ file }: Readonly<{ file: StoredFile }>) {
  const t = useTranslations("files");
  const errorMessage = useApiErrorMessage();
  const [preview, setPreview] = useState<Download | null>(null);
  const open = useMutation({
    mutationFn: (inline: boolean) => api.files.download(file.id, inline).then((response) => response.data),
    onSuccess: (download, inline) => {
      if (inline) setPreview(download);
      else window.location.assign(download.url);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (file.status !== "available") return null;

  return (
    <>
      {file.preview && file.preview !== "text" && (
        <Button variant="ghost" size="icon-sm" aria-label={t("preview", { name: file.name })} disabled={open.isPending} onClick={() => open.mutate(true)}>
          <EyeIcon aria-hidden />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={t("download", { name: file.name })} disabled={open.isPending} onClick={() => open.mutate(false)}>
        <DownloadIcon aria-hidden />
      </Button>
      <Dialog open={preview !== null} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{file.name}</DialogTitle>
          </DialogHeader>
          {preview?.preview === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; next/image would cache it
            <img src={preview.url} alt={file.name} className="max-h-[75dvh] w-full object-contain" />
          )}
          {preview?.preview === "pdf" && <iframe src={preview.url} title={file.name} className="h-[75dvh] w-full rounded-md border" />}
          {preview?.preview === "video" && (
            <video src={preview.url} controls className="max-h-[75dvh] w-full">
              <track kind="captions" />
            </video>
          )}
          {preview?.preview === "audio" && <audio src={preview.url} controls className="w-full" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A file's state while it is being checked, or after it was refused. */
export function FileStatusNote({ file }: Readonly<{ file: StoredFile }>) {
  const t = useTranslations("files.status");
  if (file.status === "available") return null;
  return (
    <span className={file.status === "rejected" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
      {t(file.status)}
    </span>
  );
}
