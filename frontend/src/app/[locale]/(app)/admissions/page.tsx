import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdmissionsOffice } from "@/features/admissions/_shared/admissions-office";
import { AdmissionsBoard } from "@/features/admissions/admissions-board/admissions-board";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.board");
  return { title: t("title") };
}

export default function Page() {
  return (
    <AdmissionsOffice>
      <AdmissionsBoard />
    </AdmissionsOffice>
  );
}
