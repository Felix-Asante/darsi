import type { ApiResponse, CursorPage, CursorQuery } from "@/common/types/api";
import type { NotificationPreference } from "@/common/types/daily";
import type { AppNotification } from "@/common/types/identity";

export interface INotificationsService {
  list: (query?: CursorQuery) => ApiResponse<CursorPage<AppNotification>>;
  unreadCount: () => ApiResponse<{ count: number }>;
  markRead: (ids: string[]) => ApiResponse<void>;
  markAllRead: () => ApiResponse<void>;
  preferences: () => ApiResponse<NotificationPreference[]>;
  savePreference: (input: NotificationPreference) => ApiResponse<void>;
}
