import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClassList } from "@/features/classes/class-list/class-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("classes");
  return { title: t("title") };
}

export default function ClassesPage() {
  return <ClassList />;
}
