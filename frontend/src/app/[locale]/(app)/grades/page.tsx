import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentGrades } from "@/features/assessment/student-grades/student-grades";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assessment.grades");
  return { title: t("title") };
}

export default function GradesPage() {
  return <StudentGrades />;
}
