import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getAnnouncementsInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: queryKeys.announcements.feed(),
    queryFn: ({ pageParam, signal }) =>
      api.announcements
        .feed(pageParam, { signal })
        .then((response) => response.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const getScheduledAnnouncementsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.announcements.scheduled(),
    queryFn: ({ signal }) =>
      api.announcements.scheduled({ signal }).then((response) => response.data),
  });

export const getClassAnnouncementSettingsQueryOptions = (classId: string) =>
  queryOptions({
    queryKey: queryKeys.announcements.classSettings(classId),
    queryFn: ({ signal }) =>
      api.announcements
        .classSettings(classId, { signal })
        .then((response) => response.data),
  });
