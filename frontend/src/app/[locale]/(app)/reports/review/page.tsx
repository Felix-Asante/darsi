import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportReview } from "@/features/reports/report-review/report-review";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports.review");
  return { title: t("title") };
}

export default function ReportReviewPage() {
  return <ReportReview />;
}
