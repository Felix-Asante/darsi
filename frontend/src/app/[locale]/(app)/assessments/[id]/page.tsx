import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GradingSheet } from "@/features/assessment/grading-sheet/grading-sheet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.list");
  return { title: t("title") };
}

export default async function AssessmentPage({
  params,
}: PageProps<"/[locale]/assessments/[id]">) {
  const { id } = await params;
  return <GradingSheet assessmentId={id} />;
}
