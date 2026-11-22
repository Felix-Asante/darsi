import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TakeAttendance } from "@/features/attendance/take-attendance/take-attendance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance");
  return { title: t("take") };
}

export default async function TakeAttendancePage({
  params,
  searchParams,
}: PageProps<"/[locale]/attendance/classes/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const date = typeof query.date === "string" ? query.date : "";
  const periodId =
    typeof query.periodId === "string" ? query.periodId : undefined;
  return (
    <TakeAttendance
      key={`${id}-${date}-${periodId}`}
      classId={id}
      date={date}
      periodId={periodId}
    />
  );
}
