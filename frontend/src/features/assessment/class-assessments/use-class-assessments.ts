import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getClassAssessmentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/assessment";
import { getPoliciesQueryOptions, getScalesQueryOptions } from "@/common/integrations/tanstack-query/query-options/grading";
import { api } from "@/common/service/api";
import type { AssessmentInput } from "@/common/types/assessment";

export function useClassAssessments(classId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all() }),
    ]);
  const schoolClass = useQuery(getClassQueryOptions(classId));
  const policies = useQuery(getPoliciesQueryOptions());
  const subjectId = schoolClass.data?.subject?.id ?? null;
  const policy =
    policies.data?.find((candidate) => subjectId && candidate.subjectId === subjectId) ??
    policies.data?.find((candidate) => candidate.subjectId === null);

  return {
    assessments: useQuery(getClassAssessmentsQueryOptions(classId)),
    scales: useQuery(getScalesQueryOptions()),
    categories: policy?.categories ?? [],
    create: useMutation({
      mutationFn: (input: AssessmentInput) => api.assessment.create(classId, input).then((response) => response.data),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.assessment.remove(id), onSuccess: refresh }),
  };
}
