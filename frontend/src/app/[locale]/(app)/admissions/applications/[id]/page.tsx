import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdmissionsOffice } from "@/features/admissions/_shared/admissions-office";
import { ApplicationReview } from "@/features/admissions/application-review/application-review";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.board");
  return { title: t("title") };
}

export default async function ApplicationReviewPage({
  params,
}: PageProps<"/[locale]/admissions/applications/[id]">) {
  const { id } = await params;
  return (
    <AdmissionsOffice>
      <ApplicationReview applicationId={id} />
    </AdmissionsOffice>
  );
}
