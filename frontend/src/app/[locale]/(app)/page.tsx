import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/common/i18n/routing";
import { ApplicantHome } from "@/features/admissions/_shared/applicant-home";
import { TodayLessons } from "@/features/timetable/today-lessons/today-lessons";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "today",
  });
  return { title: t("title") };
}

export default function TodayPage() {
  const t = useTranslations("today");

  return (
    <ApplicantHome>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <TodayLessons />
      </div>
    </ApplicantHome>
  );
}
