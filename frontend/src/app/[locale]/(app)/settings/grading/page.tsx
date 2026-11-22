import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GradingSettings } from "@/features/school/grading-settings/grading-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("grading") };
}

export default function Page() {
  return <GradingSettings />;
}
