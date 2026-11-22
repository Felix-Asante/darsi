import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getAcademicYearsQueryOptions,
  getDivisionsQueryOptions,
  getSubjectsQueryOptions,
  getTermsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import { api } from "@/common/service/api";
import type { AcademicYearInput } from "@/common/types/academics";

export function useAcademicStructure() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.academics.all() });
  const years = useQuery(getAcademicYearsQueryOptions());
  const divisions = useQuery(getDivisionsQueryOptions());
  const subjects = useQuery(getSubjectsQueryOptions());
  const currentYear = years.data?.find((year) => year.isCurrent) ?? null;
  const terms = useQuery({ ...getTermsQueryOptions(currentYear?.id ?? ""), enabled: Boolean(currentYear) });

  return {
    years,
    currentYear,
    terms,
    createTerm: useMutation({
      mutationFn: ({ yearId, ...input }: { yearId: string; name: string; startsOn: string; endsOn: string }) =>
        api.academics.createTerm(yearId, input),
      onSuccess: refresh,
    }),
    deleteTerm: useMutation({ mutationFn: (id: string) => api.academics.deleteTerm(id), onSuccess: refresh }),
    divisions,
    subjects,
    createYear: useMutation({
      mutationFn: (input: AcademicYearInput & { isCurrent: boolean }) =>
        api.academics.createYear(input).then((response) => response.data),
      onSuccess: refresh,
    }),
    makeCurrent: useMutation({
      mutationFn: (id: string) => api.academics.makeCurrent(id).then((response) => response.data),
      onSuccess: refresh,
    }),
    createDivision: useMutation({
      mutationFn: (name: string) => api.academics.createDivision({ name }),
      onSuccess: refresh,
    }),
    deleteDivision: useMutation({ mutationFn: (id: string) => api.academics.deleteDivision(id), onSuccess: refresh }),
    createGradeLevel: useMutation({
      mutationFn: (input: { divisionId: string; name: string }) => api.academics.createGradeLevel(input),
      onSuccess: refresh,
    }),
    deleteGradeLevel: useMutation({ mutationFn: (id: string) => api.academics.deleteGradeLevel(id), onSuccess: refresh }),
    createSubject: useMutation({
      mutationFn: (input: { code: string; name: string }) => api.academics.createSubject(input),
      onSuccess: refresh,
    }),
  };
}

export type AcademicStructure = ReturnType<typeof useAcademicStructure>;
