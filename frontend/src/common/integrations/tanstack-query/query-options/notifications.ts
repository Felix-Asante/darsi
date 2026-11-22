import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

const PAGE_SIZE = 20;

export const getNotificationsInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: queryKeys.notifications.list({ limit: PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      api.notifications
        .list({ limit: PAGE_SIZE, cursor: pageParam })
        .then((response) => response.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
  });

export const getUnreadCountQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () =>
      api.notifications.unreadCount().then((response) => response.data.count),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

export const getNotificationPreferencesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () =>
      api.notifications.preferences().then((response) => response.data),
  });
