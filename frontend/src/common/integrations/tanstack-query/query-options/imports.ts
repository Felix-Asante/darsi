import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import type { ImportJob } from "@/common/types/people";
import { queryKeys } from "../query-keys";

const isActive = (job: ImportJob) =>
  job.status === "queued" || job.status === "running";

export const getImportsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.imports.list(),
    queryFn: ({ signal }) =>
      api.imports.list({ signal }).then((response) => response.data),
    refetchInterval: (query) =>
      query.state.data?.some(isActive) ? 2000 : false,
  });

export const getImportColumnsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.imports.columns(),
    queryFn: ({ signal }) =>
      api.imports.columns({ signal }).then((response) => response.data),
    staleTime: Infinity,
  });
