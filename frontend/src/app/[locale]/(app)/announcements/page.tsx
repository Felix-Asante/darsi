import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnnouncementsFeed } from "@/features/announcements/feed/announcements-feed";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("announcements");
  return { title: t("title") };
}

export default function AnnouncementsPage() {
  return <AnnouncementsFeed />;
}
