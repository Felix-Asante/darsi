import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AcademicStructure } from "@/features/school/academic-structure/academic-structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("academics") };
}

export default function Page() {
  return <AcademicStructure />;
}
