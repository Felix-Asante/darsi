import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UnitsIndex } from "@/features/planning/units-index/units-index";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planning");
  return { title: t("title") };
}

export default function PlanningPage() {
  return <UnitsIndex />;
}
