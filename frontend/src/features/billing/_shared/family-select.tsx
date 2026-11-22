"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getBillingFamiliesQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { Choice } from "./choice";

export function FamilySelect({
  id,
  value,
  onChange,
}: Readonly<{
  id: string;
  value: string;
  onChange: (familyId: string) => void;
}>) {
  const t = useTranslations("billing");
  const families = useQuery(getBillingFamiliesQueryOptions());
  return (
    <Choice
      id={id}
      label={t("family")}
      className="sm:w-72"
      value={value}
      onChange={onChange}
      items={(families.data ?? []).map((family) => ({
        value: family.familyId,
        label: family.familyName,
      }))}
    />
  );
}
