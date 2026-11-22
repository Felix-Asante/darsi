import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinanceOnly } from "@/features/billing/_shared/finance-only";
import { InvoiceDetail } from "@/features/billing/invoice-detail/invoice-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.invoice");
  return { title: t("title") };
}

export default async function InvoicePage({
  params,
}: PageProps<"/[locale]/billing/invoices/[id]">) {
  const { id } = await params;
  return (
    <FinanceOnly>
      <InvoiceDetail invoiceId={id} />
    </FinanceOnly>
  );
}
