import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { ICalendarService } from "./interface";

export function createCalendarService(http: HttpClient): ICalendarService {
  const { calendar } = apiEndpoints;
  return {
    items: (range, config) =>
      http.get(calendar.items(range), undefined, config),
    createEvent: (input) => http.post(calendar.events(), input),
    updateEvent: (id, input) => http.patch(calendar.event(id), input),
    deleteEvent: (id) => http.delete(calendar.event(id)),
  };
}
