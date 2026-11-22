import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdmissionsOffice } from "@/features/admissions/_shared/admissions-office";
import { AdmissionsSettings } from "@/features/admissions/admissions-settings/admissions-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.settings");
  return { title: t("title") };
}

export default function Page() {
  return (
    <AdmissionsOffice>
      <AdmissionsSettings />
    </AdmissionsOffice>
  );
}
