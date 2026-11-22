import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getScalePresetsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.grading.presets(),
    queryFn: ({ signal }) =>
      api.grading.presets({ signal }).then((response) => response.data),
    staleTime: Infinity,
  });

export const getScalesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.grading.scales(),
    queryFn: ({ signal }) =>
      api.grading.listScales({ signal }).then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

export const getConversionsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.grading.conversions(),
    queryFn: ({ signal }) =>
      api.grading.listConversions({ signal }).then((response) => response.data),
  });

export const getPoliciesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.grading.policies(),
    queryFn: ({ signal }) =>
      api.grading.listPolicies({ signal }).then((response) => response.data),
  });
