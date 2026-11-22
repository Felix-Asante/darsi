import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getPlanTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.planning.templates(),
    queryFn: ({ signal }) =>
      api.planning.templates({ signal }).then((response) => response.data),
  });

export const getMyUnitsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.planning.mine(),
    queryFn: ({ signal }) =>
      api.planning.mine({ signal }).then((response) => response.data),
  });

export const getClassUnitsQueryOptions = (classId: string) =>
  queryOptions({
    queryKey: queryKeys.planning.forClass(classId),
    queryFn: ({ signal }) =>
      api.planning
        .forClass(classId, { signal })
        .then((response) => response.data),
  });

export const getUnitQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.planning.unit(id),
    queryFn: ({ signal }) =>
      api.planning.get(id, { signal }).then((response) => response.data),
  });
