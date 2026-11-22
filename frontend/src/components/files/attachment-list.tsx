"use client";

import { useQuery } from "@tanstack/react-query";
import { FileIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getAttachmentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/files";
import type { AttachmentTarget } from "@/common/types/files";
import { FileOpener } from "./file-opener";

/** Drive files attached to a lesson, assessment or announcement, as far as the reader may open them. */
export function AttachmentList({ targetType, targetId }: Readonly<{ targetType: AttachmentTarget; targetId: string }>) {
  const t = useTranslations("files.attachments");
  const attachments = useQuery(getAttachmentsQueryOptions(targetType, targetId));
  if (!attachments.data || attachments.data.length === 0) return null;
  return (
    <ul aria-label={t("title")} className="flex flex-col gap-1">
      {attachments.data.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-sm">
          <FileIcon aria-hidden className="text-muted-foreground size-4" />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.file && <FileOpener file={item.file} />}
        </li>
      ))}
    </ul>
  );
}
