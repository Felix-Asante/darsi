import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UnitEditor } from "@/features/planning/unit-editor/unit-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planning");
  return { title: t("title") };
}

export default async function UnitPage({
  params,
}: PageProps<"/[locale]/planning/units/[id]">) {
  const { id } = await params;
  return <UnitEditor unitId={id} />;
}
