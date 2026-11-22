import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getPortfolioOverviewQueryOptions = (studentId: string) =>
  queryOptions({
    queryKey: queryKeys.portfolio.overview(studentId),
    queryFn: ({ signal }) =>
      api.portfolio
        .overview(studentId, { signal })
        .then((response) => response.data),
    enabled: Boolean(studentId),
  });

export const getPortfolioItemsQueryOptions = (studentId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.portfolio.items(studentId),
    queryFn: ({ pageParam, signal }) =>
      api.portfolio
        .items(studentId, pageParam, { signal })
        .then((response) => response.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(studentId),
  });

export const getClassPortfolioQueryOptions = (classId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.portfolio.classItems(classId),
    queryFn: ({ pageParam, signal }) =>
      api.portfolio
        .classItems(classId, pageParam, { signal })
        .then((response) => response.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const getPortfolioSettingsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.portfolio.settings(),
    queryFn: ({ signal }) =>
      api.portfolio.settings({ signal }).then((response) => response.data),
  });
