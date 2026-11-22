import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AttendanceSettings } from "@/features/school/attendance-settings/attendance-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("attendance") };
}

export default function Page() {
  return <AttendanceSettings />;
}
