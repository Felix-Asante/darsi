"use client";

import type { ReactNode } from "react";
import { useHasRole } from "@/common/auth/me-context";
import { FinanceOnly } from "./finance-only";

/** /billing is the finance office for staff and the family account for guardians. */
export function BillingHome({
  finance,
  family,
}: Readonly<{ finance: ReactNode; family: ReactNode }>) {
  const staff = useHasRole("admin", "finance_officer");
  return staff ? <FinanceOnly>{finance}</FinanceOnly> : family;
}
