import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MyApplications } from "@/features/admissions/my-applications/my-applications";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.mine");
  return { title: t("title") };
}

export default function Page() {
  return <MyApplications />;
}
