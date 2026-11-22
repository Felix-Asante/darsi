import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getClassesQueryOptions,
  getCurrentYearQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import { api } from "@/common/service/api";
import type { ClassInput } from "@/common/types/academics";

export function useClasses() {
  const queryClient = useQueryClient();
  const currentYear = useQuery(getCurrentYearQueryOptions());
  const academicYearId = currentYear.data?.id;
  const classes = useQuery({ ...getClassesQueryOptions({ academicYearId }), enabled: Boolean(academicYearId) });

  const createClass = useMutation({
    mutationFn: (input: ClassInput) => api.academics.createClass(input).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academics.all() }),
  });

  return { currentYear, classes, createClass };
}
