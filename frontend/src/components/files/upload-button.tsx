"use client";

import { UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { api } from "@/common/service/api";
import type { StoredFile, UploadTarget } from "@/common/types/files";
import { getFieldErrors } from "@/common/utils/errors";
import { Button } from "@/components/ui/button";

interface UploadButtonProps {
  target: UploadTarget;
  label?: string;
  multiple?: boolean;
  onUploaded: (files: StoredFile[]) => void;
  variant?: "default" | "outline" | "secondary";
}

/** Picks files and uploads each one; the scan then runs in the background. */
export function UploadButton({ target, label, multiple = true, onUploaded, variant = "default" }: Readonly<UploadButtonProps>) {
  const t = useTranslations("files");
  const tRules = useTranslations("files.rules");
  const errorMessage = useApiErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    const done: StoredFile[] = [];
    for (const file of Array.from(list)) {
      try {
        done.push(await api.files.upload(file, target));
      } catch (error) {
        const rule = Object.values(getFieldErrors(error)).flat()[0];
        const reason = rule && tRules.has(rule as "typeNotAllowed") ? tRules(rule as "typeNotAllowed") : errorMessage(error);
        toast.error(t("failed", { name: file.name, reason }));
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (done.length > 0) {
      toast.success(t("uploaded", { count: done.length }));
      onUploaded(done);
    }
  };

  return (
    <>
      <input ref={input} type="file" multiple={multiple} className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => upload(event.target.files)} />
      <Button type="button" variant={variant} size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <UploadIcon aria-hidden />
        {busy ? t("uploading") : (label ?? t("upload"))}
      </Button>
    </>
  );
}
