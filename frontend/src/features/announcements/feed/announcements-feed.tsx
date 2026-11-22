"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getAnnouncementsInfiniteQueryOptions,
  getScheduledAnnouncementsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/announcements";
import { formatDateTime } from "@/common/lib/format";
import { api } from "@/common/service/api";
import type { Announcement, AnnouncementInput } from "@/common/types/daily";
import { AttachmentList } from "@/components/files/attachment-list";
import { AttachmentPicker } from "@/components/files/attachment-picker";
import { FormAlert } from "@/components/form/form-alert";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposeDialog } from "./compose-dialog";

export function AnnouncementsFeed() {
  const t = useTranslations("announcements");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const school = useCurrentSchool();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const canPost = useHasRole("admin", "coordinator", "admissions_officer", "finance_officer", "teacher", "teaching_assistant");
  const feed = useInfiniteQuery(getAnnouncementsInfiniteQueryOptions());
  const scheduled = useQuery({ ...getScheduledAnnouncementsQueryOptions(), enabled: canPost });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all() });
  const remove = useMutation({
    mutationFn: (id: string) => api.announcements.remove(id),
    onSuccess: () => {
      toast.success(t("deleted"));
      return refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const audienceLabel = (item: Announcement) =>
    item.audience === "school"
      ? t("audiences.school")
      : item.audience === "role" && item.audienceRole
        ? tRoles(item.audienceRole as "admin")
        : (item.audienceName ?? t(`audiences.${item.audience}`));

  const card = (item: Announcement, isScheduled = false) => (
    <article key={item.id} aria-labelledby={`announcement-${item.id}`} className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`announcement-${item.id}`} className="text-base font-semibold tracking-tight">
            {item.title}
          </h2>
          <p className="text-muted-foreground text-sm">
            {item.author?.name}
            {" · "}
            {t("to", { audience: audienceLabel(item) })}
            {" · "}
            <time dateTime={item.publishedAt ?? item.publishAt}>
              {isScheduled
                ? t("scheduledFor", { time: formatDateTime(item.publishAt, locale, school.timeZone) })
                : formatDateTime(item.publishedAt ?? item.publishAt, locale, school.timeZone)}
            </time>
          </p>
        </div>
        {isScheduled && <Badge variant="info">{t("scheduled")}</Badge>}
        {item.canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("deleteLabel", { title: item.title })}
            disabled={remove.isPending}
            onClick={() => remove.mutate(item.id)}
          >
            <Trash2Icon aria-hidden />
          </Button>
        )}
      </header>
      <RichTextView doc={item.body} />
      <AttachmentList targetType="announcement" targetId={item.id} />
      {item.canDelete && item.audience === "class" && item.audienceId && (
        <div>
          <AttachmentPicker classId={item.audienceId} targetType="announcement" targetId={item.id} />
        </div>
      )}
    </article>
  );

  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        {canPost && (
          <ComposeDialog
            onSend={async (input: AnnouncementInput) => {
              await api.announcements.create(input);
              await refresh();
            }}
          />
        )}
      </div>
      {scheduled.data && scheduled.data.length > 0 && (
        <section aria-label={t("scheduled")} className="flex flex-col gap-3">
          {scheduled.data.map((item) => card(item, true))}
        </section>
      )}
      <FormAlert message={feed.error ? errorMessage(feed.error) : null} />
      {feed.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">{items.map((item) => card(item))}</div>
      )}
      {feed.hasNextPage && (
        <Button variant="outline" className="self-center" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
