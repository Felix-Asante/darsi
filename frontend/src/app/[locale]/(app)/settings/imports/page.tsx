import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ImportManager } from "@/features/school/imports/import-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("imports") };
}

export default function Page() {
  return <ImportManager />;
}
