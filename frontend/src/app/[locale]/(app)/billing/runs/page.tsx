import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinanceOnly } from "@/features/billing/_shared/finance-only";
import { InvoiceRun } from "@/features/billing/invoice-run/invoice-run";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.runs");
  return { title: t("title") };
}

export default function Page() {
  return (
    <FinanceOnly>
      <InvoiceRun />
    </FinanceOnly>
  );
}
