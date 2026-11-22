import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import type { SchoolSettingsValues } from "./school-settings.schema";

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SchoolSettingsValues) => api.school.completeOnboarding(values).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me.all() }),
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SchoolSettingsValues) => api.school.update(values).then((response) => response.data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.school.all() }),
      ]),
  });
}
