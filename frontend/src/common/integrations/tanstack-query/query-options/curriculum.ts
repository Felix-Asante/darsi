import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getFrameworksQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.curriculum.frameworks(),
    queryFn: ({ signal }) =>
      api.curriculum
        .listFrameworks({ signal })
        .then((response) => response.data),
  });

export const getStandardsQueryOptions = (frameworkId: string) =>
  queryOptions({
    queryKey: queryKeys.curriculum.standards(frameworkId),
    queryFn: ({ signal }) =>
      api.curriculum
        .standards(frameworkId, { signal })
        .then((response) => response.data),
    enabled: Boolean(frameworkId),
  });
