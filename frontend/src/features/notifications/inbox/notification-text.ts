import { useTranslations } from "next-intl";
import type messages from "@/common/i18n/messages/en.json";
import type { AppNotification } from "@/common/types/identity";

type NotificationType = keyof (typeof messages)["notifications"]["types"];

/** Each notification type has a sentence per language; its params fill the blanks. */
export function useNotificationText(notification: AppNotification): string {
  const t = useTranslations("notifications.types");
  const type = notification.type.replace(/\./g, "_") as NotificationType;
  const params = Object.fromEntries(
    Object.entries(notification.params).map(([key, value]) => [key, value ?? ""]),
  ) as Record<string, string | number>;
  return t.has(type) ? t(type, params) : t("generic");
}
