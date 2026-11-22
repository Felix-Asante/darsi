import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdmissionsOffice } from "@/features/admissions/_shared/admissions-office";
import { ReEnrolmentAdmin } from "@/features/admissions/re-enrolment/re-enrolment-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.reEnrolment");
  return { title: t("title") };
}

export default function Page() {
  return (
    <AdmissionsOffice>
      <ReEnrolmentAdmin />
    </AdmissionsOffice>
  );
}
