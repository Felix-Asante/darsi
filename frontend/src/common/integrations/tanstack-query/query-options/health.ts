import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getReadinessQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.health.readiness(),
    queryFn: ({ signal }) =>
      api.health.getReadiness({ signal }).then((response) => response.data),
    staleTime: 30 * 1000,
  });
