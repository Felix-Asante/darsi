import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AttendanceHome } from "@/features/attendance/attendance-home/attendance-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance");
  return { title: t("title") };
}

export default function AttendancePage() {
  return <AttendanceHome />;
}
