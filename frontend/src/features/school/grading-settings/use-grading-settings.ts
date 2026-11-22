import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getSubjectsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import {
  getConversionsQueryOptions,
  getPoliciesQueryOptions,
  getScalePresetsQueryOptions,
  getScalesQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/grading";
import { api } from "@/common/service/api";
import type { IGradingService } from "@/common/service/grading/interface";

type Input<K extends keyof IGradingService> = Parameters<IGradingService[K]>;

export function useGradingSettings() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.grading.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all() }),
    ]);

  return {
    presets: useQuery(getScalePresetsQueryOptions()),
    scales: useQuery(getScalesQueryOptions()),
    conversions: useQuery(getConversionsQueryOptions()),
    policies: useQuery(getPoliciesQueryOptions()),
    subjects: useQuery(getSubjectsQueryOptions()),
    createScale: useMutation({
      mutationFn: (...[input]: Input<"createScale">) => api.grading.createScale(input).then((response) => response.data),
      onSuccess: refresh,
    }),
    updateScale: useMutation({
      mutationFn: ({ id, ...input }: Input<"updateScale">[1] & { id: string }) =>
        api.grading.updateScale(id, input).then((response) => response.data),
      onSuccess: refresh,
    }),
    saveConversion: useMutation({
      mutationFn: (...[input]: Input<"saveConversion">) => api.grading.saveConversion(input),
      onSuccess: refresh,
    }),
    savePolicy: useMutation({
      mutationFn: (...[input]: Input<"savePolicy">) => api.grading.savePolicy(input),
      onSuccess: refresh,
    }),
  };
}

export type GradingSettings = ReturnType<typeof useGradingSettings>;
