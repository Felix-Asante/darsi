import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationPreferences } from "@/features/notifications/preferences/notification-preferences";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notificationSettings");
  return { title: t("title") };
}

export default function NotificationSettingsPage() {
  return <NotificationPreferences />;
}
