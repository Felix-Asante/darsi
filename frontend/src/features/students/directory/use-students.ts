import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getStudentsInfiniteQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { api } from "@/common/service/api";
import type { StudentInput, StudentStatus } from "@/common/types/people";

export function useStudents(filters: {
  search: string;
  gradeLevelId: string;
  status: StudentStatus | "";
}) {
  return useInfiniteQuery(
    getStudentsInfiniteQueryOptions({
      search: filters.search || undefined,
      gradeLevelId: filters.gradeLevelId || undefined,
      status: filters.status || undefined,
    }),
  );
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) =>
      api.people.createStudent(input).then((response) => response.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all() }),
  });
}
