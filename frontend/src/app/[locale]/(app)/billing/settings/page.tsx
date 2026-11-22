import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinanceOnly } from "@/features/billing/_shared/finance-only";
import { BillingSettings } from "@/features/billing/billing-settings/billing-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.settings");
  return { title: t("title") };
}

export default function Page() {
  return (
    <FinanceOnly>
      <BillingSettings />
    </FinanceOnly>
  );
}
