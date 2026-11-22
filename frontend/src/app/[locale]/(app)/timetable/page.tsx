import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeekTimetable } from "@/features/timetable/week-timetable/week-timetable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("timetable");
  return { title: t("title") };
}

export default function TimetablePage() {
  return <WeekTimetable />;
}
