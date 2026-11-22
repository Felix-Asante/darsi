import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getPlanTemplatesQueryOptions, getUnitQueryOptions } from "@/common/integrations/tanstack-query/query-options/planning";
import { api } from "@/common/service/api";
import type { LessonInput, UnitInput, UnitPlan } from "@/common/types/daily";

export function useUnit(id: string) {
  const queryClient = useQueryClient();
  const store = (unit: UnitPlan) => {
    queryClient.setQueryData(queryKeys.planning.unit(id), unit);
    return queryClient.invalidateQueries({ queryKey: queryKeys.planning.all(), refetchType: "none" });
  };
  return {
    unit: useQuery(getUnitQueryOptions(id)),
    templates: useQuery(getPlanTemplatesQueryOptions()),
    update: useMutation({ mutationFn: (input: UnitInput) => api.planning.update(id, input).then((r) => r.data), onSuccess: store }),
    saveLesson: useMutation({
      mutationFn: ({ lessonId, ...input }: LessonInput & { lessonId?: string }) =>
        api.planning.saveLesson(id, input, lessonId).then((r) => r.data),
      onSuccess: store,
    }),
    removeLesson: useMutation({
      mutationFn: (lessonId: string) => api.planning.removeLesson(id, lessonId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.planning.all() }),
    }),
    setCollaborators: useMutation({
      mutationFn: (collaborators: { userId: string; role: "editor" | "viewer" }[]) =>
        api.planning.setCollaborators(id, collaborators).then((r) => r.data),
      onSuccess: store,
    }),
    linkAssessments: useMutation({
      mutationFn: (assessmentIds: string[]) => api.planning.linkAssessments(id, assessmentIds).then((r) => r.data),
      onSuccess: store,
    }),
    copy: useMutation({
      mutationFn: (input: { classIds: string[]; shiftDays: number }) => api.planning.copy(id, input).then((r) => r.data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.planning.all() }),
    }),
    remove: useMutation({
      mutationFn: () => api.planning.remove(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.planning.all() }),
    }),
  };
}

export type UnitHandle = ReturnType<typeof useUnit>;
