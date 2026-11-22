import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AssistantsCanPost } from "@/features/announcements/class-settings/assistants-can-post";
import { ClassAssessments } from "@/features/assessment/class-assessments/class-assessments";
import { ClassPortfolio } from "@/features/portfolio/class-portfolio/class-portfolio";
import { ClassDetail } from "@/features/classes/class-detail/class-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("classes");
  return { title: t("title") };
}

export default async function ClassPage({
  params,
}: PageProps<"/[locale]/classes/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ClassDetail classId={id} />
      <ClassAssessments classId={id} />
      <AssistantsCanPost classId={id} />
      <ClassPortfolio classId={id} />
    </div>
  );
}
