import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentDirectory } from "@/features/students/directory/student-directory";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("students");
  return { title: t("title") };
}

export default function StudentsPage() {
  return <StudentDirectory />;
}
