import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportTemplates } from "@/features/school/report-templates/report-templates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("reports") };
}

export default function Page() {
  return <ReportTemplates />;
}
