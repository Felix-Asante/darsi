import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FamilyReEnrolment } from "@/features/admissions/family-re-enrolment/family-re-enrolment";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.familyReEnrolment");
  return { title: t("title") };
}

export default function Page() {
  return <FamilyReEnrolment />;
}
