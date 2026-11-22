import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

const STRUCTURE_STALE_TIME = 5 * 60 * 1000;

export const getAcademicYearsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.academics.years(),
    queryFn: ({ signal }) =>
      api.academics.listYears({ signal }).then((response) => response.data),
    staleTime: STRUCTURE_STALE_TIME,
  });

export const getDivisionsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.academics.divisions(),
    queryFn: ({ signal }) =>
      api.academics.listDivisions({ signal }).then((response) => response.data),
    staleTime: STRUCTURE_STALE_TIME,
  });

export const getSubjectsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.academics.subjects(),
    queryFn: ({ signal }) =>
      api.academics.listSubjects({ signal }).then((response) => response.data),
    staleTime: STRUCTURE_STALE_TIME,
  });

export const getClassesQueryOptions = (
  query: { academicYearId?: string; mine?: boolean } = {},
) =>
  queryOptions({
    queryKey: queryKeys.academics.classes(query),
    queryFn: ({ signal }) =>
      api.academics
        .listClasses(query, { signal })
        .then((response) => response.data),
  });

export const getClassQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.academics.class(id),
    queryFn: ({ signal }) =>
      api.academics.getClass(id, { signal }).then((response) => response.data),
  });

export const getRosterQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.academics.roster(id),
    queryFn: ({ signal }) =>
      api.academics.roster(id, { signal }).then((response) => response.data),
  });

/** Every grade level, in division order, labelled for pickers. */
export const getGradeLevelsQueryOptions = () =>
  queryOptions({
    ...getDivisionsQueryOptions(),
    select: (divisions) =>
      divisions.flatMap((division) =>
        division.gradeLevels.map((level) => ({
          value: level.id,
          label: level.name,
          division: division.name,
        })),
      ),
  });

/** The current academic year, or null when the school hasn't set one. */
export const getCurrentYearQueryOptions = () =>
  queryOptions({
    ...getAcademicYearsQueryOptions(),
    select: (years) => years.find((year) => year.isCurrent) ?? null,
  });

export const getTermsQueryOptions = (yearId: string) =>
  queryOptions({
    queryKey: queryKeys.academics.terms(yearId),
    queryFn: ({ signal }) =>
      api.academics
        .listTerms(yearId, { signal })
        .then((response) => response.data),
    staleTime: STRUCTURE_STALE_TIME,
  });
