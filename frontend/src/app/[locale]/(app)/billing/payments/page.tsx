import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinanceOnly } from "@/features/billing/_shared/finance-only";
import { Payments } from "@/features/billing/payments/payments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.payments");
  return { title: t("title") };
}

export default function Page() {
  return (
    <FinanceOnly>
      <Payments />
    </FinanceOnly>
  );
}
