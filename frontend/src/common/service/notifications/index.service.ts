import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { INotificationsService } from "./interface";

export function createNotificationsService(
  http: HttpClient,
): INotificationsService {
  const { notifications } = apiEndpoints;
  return {
    list: (query) => http.get(notifications.list(query)),
    unreadCount: () => http.get(notifications.unreadCount()),
    markRead: (ids) => http.post(notifications.markRead(), { ids }),
    markAllRead: () => http.post(notifications.markAllRead()),
    preferences: () => http.get(notifications.preferences()),
    savePreference: (input) => http.put(notifications.preferences(), input),
  };
}
