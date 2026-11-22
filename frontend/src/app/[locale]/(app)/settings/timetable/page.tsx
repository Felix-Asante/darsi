import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BellSchedules } from "@/features/school/bell-schedules/bell-schedules";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("timetable") };
}

export default function Page() {
  return <BellSchedules />;
}
