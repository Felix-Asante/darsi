import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CurriculumFrameworks } from "@/features/school/curriculum/curriculum-frameworks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("curriculum") };
}

export default function Page() {
  return <CurriculumFrameworks />;
}
