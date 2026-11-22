import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MembersManager } from "@/features/school/members/members-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.members");
  return { title: t("title") };
}

export default function MembersPage() {
  return <MembersManager />;
}
