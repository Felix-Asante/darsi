import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportCard } from "@/features/reports/report-card/report-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

export default async function ReportCardPage({
  params,
}: PageProps<"/[locale]/reports/cards/[id]">) {
  const { id } = await params;
  return <ReportCard cardId={id} />;
}
