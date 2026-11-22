import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from "@tanstack/react-query";
import { api } from "@/common/service/api";
import type { StudentListQuery } from "@/common/types/people";
import { queryKeys } from "../query-keys";

const PAGE_SIZE = 50;

export const getStudentsInfiniteQueryOptions = (
  filters: Omit<StudentListQuery, "cursor" | "limit"> = {},
) =>
  infiniteQueryOptions({
    queryKey: queryKeys.people.students({ ...filters, limit: PAGE_SIZE }),
    queryFn: ({ pageParam, signal }) =>
      api.people
        .listStudents(
          { ...filters, limit: PAGE_SIZE, cursor: pageParam },
          { signal },
        )
        .then((response) => response.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

export const getStudentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.people.student(id),
    queryFn: ({ signal }) =>
      api.people.getStudent(id, { signal }).then((response) => response.data),
  });

export const getGuardiansQueryOptions = (search: string) =>
  queryOptions({
    queryKey: queryKeys.people.guardians(search),
    queryFn: ({ signal }) =>
      api.people
        .listGuardians(search || undefined, { signal })
        .then((response) => response.data),
    placeholderData: (previous) => previous,
  });

/** The first 30 active students matching `search`, for pickers. */
export const getStudentSearchQueryOptions = (search: string, enabled = true) =>
  queryOptions({
    enabled,
    queryKey: queryKeys.people.studentSearch(search),
    queryFn: ({ signal }) =>
      api.people
        .listStudents(
          { search: search || undefined, status: "active", limit: 30 },
          { signal },
        )
        .then((response) => response.data.items),
    placeholderData: (previous) => previous,
  });

export const getOwnStudentsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.people.mine(),
    queryFn: ({ signal }) =>
      api.people.mine({ signal }).then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });
