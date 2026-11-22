import { useTranslations } from "next-intl";
import type { ReportStatus } from "@/common/types/portfolio";
import { Badge } from "@/components/ui/badge";

const VARIANT = { draft: "info", returned: "warning", approved: "secondary", published: "success" } as const;

export function ReportStatusBadge({ status }: Readonly<{ status: ReportStatus }>) {
  const t = useTranslations("reports.statuses");
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
