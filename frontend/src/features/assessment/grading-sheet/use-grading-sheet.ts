import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getGradingSheetQueryOptions } from "@/common/integrations/tanstack-query/query-options/assessment";
import { api } from "@/common/service/api";
import type { GradeEntry } from "@/common/types/assessment";

export function useGradingSheet(id: string) {
  const queryClient = useQueryClient();
  const onSuccess = (sheet: Awaited<ReturnType<typeof api.assessment.sheet>>["data"]) => {
    queryClient.setQueryData(queryKeys.assessment.sheet(id), sheet);
    return queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all(), refetchType: "none" });
  };
  return {
    sheet: useQuery(getGradingSheetQueryOptions(id)),
    save: useMutation({
      mutationFn: (input: { grades: GradeEntry[]; publish: boolean }) =>
        api.assessment.saveGrades(id, input).then((response) => response.data),
      onSuccess,
    }),
    publishAll: useMutation({
      mutationFn: () => api.assessment.publishAll(id).then((response) => response.data),
      onSuccess,
    }),
  };
}
