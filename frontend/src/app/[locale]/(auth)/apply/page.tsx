import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplyPage } from "@/features/admissions/apply-page/apply-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.apply");
  return { title: t("title") };
}

export default function Page() {
  return <ApplyPage />;
}
