import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplyStart } from "@/features/admissions/apply-start/apply-start";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.apply");
  return { title: t("title") };
}

export default function Page() {
  return <ApplyStart />;
}
