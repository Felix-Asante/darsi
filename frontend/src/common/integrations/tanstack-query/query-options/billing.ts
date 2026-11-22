import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getBillingSettingsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.billing.settings(),
    queryFn: ({ signal }) =>
      api.billing.settings({ signal }).then((r) => r.data),
  });

export const getFeeItemsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.billing.feeItems(),
    queryFn: ({ signal }) =>
      api.billing.feeItems({ signal }).then((r) => r.data),
  });

export const getFeeStructuresQueryOptions = (yearId: string) =>
  queryOptions({
    queryKey: queryKeys.billing.structures(yearId),
    queryFn: ({ signal }) =>
      api.billing.structures(yearId, { signal }).then((r) => r.data),
    enabled: Boolean(yearId),
  });

export const getDiscountsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.billing.discounts(),
    queryFn: ({ signal }) =>
      api.billing.discounts({ signal }).then((r) => r.data),
  });

export const getInvoicesQueryOptions = (
  query: { familyId?: string; status?: "draft" | "issued" } = {},
) =>
  queryOptions({
    queryKey: queryKeys.billing.invoices(query),
    queryFn: ({ signal }) =>
      api.billing.invoices(query, { signal }).then((r) => r.data),
  });

export const getInvoiceQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.billing.invoice(id),
    queryFn: ({ signal }) =>
      api.billing.invoice(id, { signal }).then((r) => r.data),
  });

export const getPaymentsQueryOptions = (familyId?: string) =>
  queryOptions({
    queryKey: queryKeys.billing.payments(familyId),
    queryFn: ({ signal }) =>
      api.billing.payments(familyId, { signal }).then((r) => r.data),
  });

export const getStatementsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.billing.statements(),
    queryFn: ({ signal }) =>
      api.billing.statements({ signal }).then((r) => r.data),
  });

export const getOutstandingQueryOptions = (gradeLevelId?: string) =>
  queryOptions({
    queryKey: queryKeys.billing.outstanding(gradeLevelId),
    queryFn: ({ signal }) =>
      api.billing.outstanding(gradeLevelId, { signal }).then((r) => r.data),
  });

export const getBillingFamiliesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.billing.families(),
    queryFn: ({ signal }) =>
      api.billing.families({ signal }).then((r) => r.data),
  });

export const getCollectionsQueryOptions = (range: {
  from: string;
  to: string;
}) =>
  queryOptions({
    queryKey: queryKeys.billing.collections(range),
    queryFn: ({ signal }) =>
      api.billing.collections(range, { signal }).then((r) => r.data),
  });
