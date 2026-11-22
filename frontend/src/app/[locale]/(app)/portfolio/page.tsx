import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PortfolioIndex } from "@/features/portfolio/portfolio-index/portfolio-index";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portfolio");
  return { title: t("title") };
}

export default function PortfolioPage() {
  return <PortfolioIndex />;
}
