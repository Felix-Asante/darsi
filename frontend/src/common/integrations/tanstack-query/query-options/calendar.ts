import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getCalendarItemsQueryOptions = (from: string, to: string) =>
  queryOptions({
    queryKey: queryKeys.calendar.items(from, to),
    queryFn: ({ signal }) =>
      api.calendar
        .items({ from, to }, { signal })
        .then((response) => response.data),
    placeholderData: (previous) => previous,
  });
