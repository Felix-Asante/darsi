import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AttendanceReport } from "@/features/attendance/attendance-report/attendance-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance.reportPage");
  return { title: t("title") };
}

export default function AttendanceReportPage() {
  return <AttendanceReport />;
}
