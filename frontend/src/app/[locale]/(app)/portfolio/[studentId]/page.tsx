import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentPortfolio } from "@/features/portfolio/student-portfolio/student-portfolio";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portfolio");
  return { title: t("title") };
}

export default async function StudentPortfolioPage({
  params,
}: PageProps<"/[locale]/portfolio/[studentId]">) {
  const { studentId } = await params;
  return <StudentPortfolio studentId={studentId} />;
}
