import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getClassAssessmentsQueryOptions = (classId: string) =>
  queryOptions({
    queryKey: queryKeys.assessment.forClass(classId),
    queryFn: ({ signal }) =>
      api.assessment
        .listForClass(classId, { signal })
        .then((response) => response.data),
  });

export const getGradingSheetQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.assessment.sheet(id),
    queryFn: ({ signal }) =>
      api.assessment.sheet(id, { signal }).then((response) => response.data),
  });

export const getGradebookQueryOptions = (classId: string, termId?: string) =>
  queryOptions({
    queryKey: queryKeys.assessment.gradebook(classId, termId),
    queryFn: ({ signal }) =>
      api.assessment
        .gradebook(classId, termId, { signal })
        .then((response) => response.data),
    placeholderData: (previous) => previous,
  });

export const getStudentGradesQueryOptions = (
  studentId: string,
  termId?: string,
) =>
  queryOptions({
    queryKey: queryKeys.assessment.studentGrades(studentId, termId),
    queryFn: ({ signal }) =>
      api.assessment
        .studentGrades(studentId, termId, { signal })
        .then((response) => response.data),
    enabled: Boolean(studentId),
    placeholderData: (previous) => previous,
  });
