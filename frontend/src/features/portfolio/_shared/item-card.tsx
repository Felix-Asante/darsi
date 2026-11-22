"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { formatDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import type { PortfolioItem } from "@/common/types/portfolio";
import { FileOpener, FileStatusNote } from "@/components/files/file-opener";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** One piece of work with its comments and reflections (PRT-2/3/4). */
export function ItemCard({ item, canDiscuss, isStaff }: Readonly<{ item: PortfolioItem; canDiscuss: boolean; isStaff: boolean }>) {
  const t = useTranslations("portfolio");
  const locale = useLocale();
  const school = useCurrentSchool();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const approve = useMutation({ mutationFn: () => api.portfolio.approve(item.id), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: () => api.portfolio.remove(item.id), onSuccess: refresh, onError });
  const send = useMutation({
    mutationFn: () => api.portfolio.comment(item.id, comment.trim()),
    onSuccess: () => {
      setComment("");
      return refresh();
    },
    onError,
  });

  return (
    <article aria-labelledby={`item-${item.id}`} className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={`item-${item.id}`} className="font-semibold">
            {item.title}
          </h3>
          <p className="text-muted-foreground text-xs">
            {t(`kinds.${item.kind}`)}
            {item.addedBy && ` · ${t("addedBy", { name: item.addedBy.name })}`}
            {" · "}
            {formatDate(item.createdAt, locale, school.timeZone)}
          </p>
        </div>
        {item.status === "pending" && <Badge variant="warning">{t("pending")}</Badge>}
        {item.canApprove && (
          <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate()}>
            <CheckIcon aria-hidden />
            {t("approve")}
          </Button>
        )}
        {item.canDelete && (
          <Button variant="ghost" size="icon-sm" aria-label={t("delete", { title: item.title })} onClick={() => remove.mutate()}>
            <Trash2Icon aria-hidden />
          </Button>
        )}
      </header>
      {item.description && <p className="text-sm whitespace-pre-line">{item.description}</p>}
      {item.kind === "text" && <RichTextView doc={item.body} />}
      {item.kind === "link" && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary inline-flex items-center gap-1 text-sm break-all underline">
          {item.url}
          <ExternalLinkIcon aria-hidden className="size-3.5" />
        </a>
      )}
      {item.file && (
        <div className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
          <FileStatusNote file={item.file} />
          <FileOpener file={item.file} />
        </div>
      )}
      {item.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="outline">#{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      {(item.comments.length > 0 || canDiscuss) && (
        <section aria-label={t("comments")} className="flex flex-col gap-2 border-t pt-3">
          {item.comments.map((entry) => (
            <p key={entry.id} className="text-sm">
              <span className="font-medium">{entry.author?.name}</span>
              {entry.kind === "reflection" && <span className="text-muted-foreground"> · {t("reflection")}</span>}
              <span className="text-muted-foreground">: </span>
              {entry.body}
            </p>
          ))}
          {canDiscuss && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (comment.trim()) send.mutate();
              }}
            >
              <Input
                aria-label={isStaff ? t("comment") : t("reflect")}
                placeholder={isStaff ? t("comment") : t("reflect")}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button type="submit" variant="secondary" size="sm" disabled={!comment.trim() || send.isPending}>
                {t("send")}
              </Button>
            </form>
          )}
        </section>
      )}
    </article>
  );
}
