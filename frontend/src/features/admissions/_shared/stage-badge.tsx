import type { Stage, StageKind } from "@/common/types/admissions";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<
  StageKind,
  "info" | "warning" | "success" | "destructive" | "outline" | "secondary"
> = {
  enquiry: "outline",
  submitted: "info",
  review: "warning",
  interview: "warning",
  offered: "warning",
  accepted: "success",
  enrolled: "success",
  waitlisted: "secondary",
  declined: "destructive",
  withdrawn: "secondary",
};

export function StageBadge({
  stage,
}: Readonly<{ stage: Pick<Stage, "name" | "kind"> }>) {
  return <Badge variant={VARIANT[stage.kind]}>{stage.name}</Badge>;
}
