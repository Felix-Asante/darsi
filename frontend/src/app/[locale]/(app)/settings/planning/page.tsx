import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlanTemplates } from "@/features/school/plan-templates/plan-templates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planning.templates");
  return { title: t("title") };
}

export default function Page() {
  return <PlanTemplates />;
}
