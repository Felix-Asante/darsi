import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplicationForm } from "@/features/admissions/application-form/application-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admissions.mine");
  return { title: t("title") };
}

export default async function ApplicationPage({
  params,
}: PageProps<"/[locale]/applications/[id]">) {
  const { id } = await params;
  return <ApplicationForm applicationId={id} />;
}
