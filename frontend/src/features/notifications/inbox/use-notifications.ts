import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationsInfiniteQueryOptions,
  getUnreadCountQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/notifications";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";

export function useUnreadCount() {
  return useQuery(getUnreadCountQueryOptions()).data ?? 0;
}

export function useNotifications(enabled: boolean) {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery({ ...getNotificationsInfiniteQueryOptions(), enabled });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });

  const markRead = useMutation({ mutationFn: (ids: string[]) => api.notifications.markRead(ids), onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: () => api.notifications.markAllRead(), onSuccess: refresh });

  return {
    notifications: list.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: list.isPending && enabled,
    hasNextPage: list.hasNextPage,
    fetchNextPage: list.fetchNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    isMarkingAll: markAllRead.isPending,
  };
}
