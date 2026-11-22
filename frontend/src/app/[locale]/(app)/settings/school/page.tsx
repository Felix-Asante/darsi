import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SchoolSettingsForm } from "@/features/school/school-settings/school-settings-form";
import { StorageUsage } from "@/features/school/storage-usage/storage-usage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.school");
  return { title: t("title") };
}

export default function SchoolSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <SchoolSettingsForm />
      <StorageUsage />
    </div>
  );
}
