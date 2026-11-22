"use client";

import { BellIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/common/i18n/navigation";
import type { AppNotification } from "@/common/types/identity";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationText } from "./notification-text";
import { useNotifications, useUnreadCount } from "./use-notifications";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const label = unread > 0 ? `${t("label")}, ${t("unread", { count: unread })}` : t("label");

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" aria-label={label} onClick={() => setOpen(true)}>
        <BellIcon aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="bg-destructive text-destructive-foreground absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          {open && <Inbox onNavigate={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Inbox({ onNavigate }: Readonly<{ onNavigate: () => void }>) {
  const t = useTranslations("notifications");
  const inbox = useNotifications(true);
  const hasUnread = inbox.notifications.some((notification) => !notification.readAt);

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription className="sr-only">{t("label")}</SheetDescription>
        {hasUnread && (
          <Button
            variant="link"
            size="sm"
            className="self-start px-0"
            disabled={inbox.isMarkingAll}
            onClick={() => inbox.markAllRead()}
          >
            {t("markAllRead")}
          </Button>
        )}
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        {inbox.isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : inbox.notifications.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-y">
            {inbox.notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => {
                  if (!notification.readAt) inbox.markRead([notification.id]);
                  onNavigate();
                }}
              />
            ))}
          </ul>
        )}
        {inbox.hasNextPage && (
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full"
              disabled={inbox.isFetchingNextPage}
              onClick={() => inbox.fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function NotificationRow({ notification, onOpen }: Readonly<{ notification: AppNotification; onOpen: () => void }>) {
  const format = useFormatter();
  const router = useRouter();
  const text = useNotificationText(notification);

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onOpen();
          if (notification.link) router.push(notification.link);
        }}
        className="hover:bg-accent focus-visible:ring-ring/50 flex w-full gap-3 px-4 py-3 text-start outline-none focus-visible:ring-3 focus-visible:ring-inset"
      >
        <span
          aria-hidden
          className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-primary"}`}
        />
        <span className="flex flex-col gap-0.5">
          <span className={`text-sm ${notification.readAt ? "" : "font-medium"}`}>{text}</span>
          <time dateTime={notification.createdAt} className="text-muted-foreground text-xs">
            {format.relativeTime(new Date(notification.createdAt))}
          </time>
        </span>
      </button>
    </li>
  );
}
