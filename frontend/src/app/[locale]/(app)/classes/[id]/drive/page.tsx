import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClassDrive } from "@/features/drive/class-drive/class-drive";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("files.drive");
  return { title: t("title") };
}

export default async function ClassDrivePage({
  params,
  searchParams,
}: PageProps<"/[locale]/classes/[id]/drive">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const folderId = typeof query.folder === "string" ? query.folder : undefined;
  return (
    <ClassDrive key={folderId ?? "root"} classId={id} folderId={folderId} />
  );
}
