import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BillingHome } from "@/features/billing/_shared/billing-home";
import { FamilyBilling } from "@/features/billing/family-billing/family-billing";
import { InvoicesList } from "@/features/billing/invoices-list/invoices-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingHome finance={<InvoicesList />} family={<FamilyBilling />} />
    </Suspense>
  );
}
