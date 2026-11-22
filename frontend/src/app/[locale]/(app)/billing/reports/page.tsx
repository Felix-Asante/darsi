import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinanceOnly } from "@/features/billing/_shared/finance-only";
import { FinanceReports } from "@/features/billing/finance-reports/finance-reports";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.reports");
  return { title: t("title") };
}

export default function Page() {
  return (
    <FinanceOnly>
      <FinanceReports />
    </FinanceOnly>
  );
}
