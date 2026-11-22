import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClassGradebook } from "@/features/assessment/gradebook/class-gradebook";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.gradebook");
  return { title: t("title") };
}

export default async function ClassGradebookPage({
  params,
}: PageProps<"/[locale]/classes/[id]/gradebook">) {
  const { id } = await params;
  return <ClassGradebook classId={id} />;
}
