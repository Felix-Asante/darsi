import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GradebookIndex } from "@/features/assessment/gradebook/gradebook-index";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.gradebook");
  return { title: t("title") };
}

export default function GradebookPage() {
  return <GradebookIndex />;
}
