import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentFiles } from "@/features/students/student-files/student-files";
import { StudentProfile } from "@/features/students/profile/student-profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("students");
  return { title: t("title") };
}

export default async function StudentPage({
  params,
}: PageProps<"/[locale]/students/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <StudentProfile studentId={id} />
      <StudentFiles studentId={id} />
    </div>
  );
}
