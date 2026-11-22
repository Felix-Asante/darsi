import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentAttendance } from "@/features/attendance/student-attendance/student-attendance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance.student");
  return { title: t("title") };
}

export default async function StudentAttendancePage({
  params,
}: PageProps<"/[locale]/attendance/students/[id]">) {
  const { id } = await params;
  return <StudentAttendance studentId={id} />;
}
