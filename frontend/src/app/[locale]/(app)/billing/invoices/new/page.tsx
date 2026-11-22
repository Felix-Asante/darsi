import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinanceOnly } from "@/features/billing/_shared/finance-only";
import { NewInvoiceForm } from "@/features/billing/new-invoice/new-invoice-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.newInvoice");
  return { title: t("title") };
}

export default function Page() {
  return (
    <FinanceOnly>
      <NewInvoiceForm />
    </FinanceOnly>
  );
}
