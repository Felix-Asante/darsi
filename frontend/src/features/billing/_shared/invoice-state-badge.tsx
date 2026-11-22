import { useTranslations } from "next-intl";
import type { InvoiceState } from "@/common/types/billing";
import { Badge } from "@/components/ui/badge";

const VARIANT = {
  draft: "info",
  open: "outline",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
} as const;

export function InvoiceStateBadge({
  state,
}: Readonly<{ state: InvoiceState }>) {
  const t = useTranslations("billing.states");
  return <Badge variant={VARIANT[state]}>{t(state)}</Badge>;
}
