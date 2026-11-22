import type { ApiResponse } from "@/common/types/api";
import type { CalendarEventInput, CalendarItem } from "@/common/types/calendar";
import type { RequestConfig } from "../http.service";

export interface ICalendarService {
  /** The signed-in user's calendar between two dates (inclusive, at most 100 days). */
  items: (
    range: { from: string; to: string },
    config?: RequestConfig,
  ) => ApiResponse<CalendarItem[]>;
  createEvent: (input: CalendarEventInput) => ApiResponse<{ id: string }>;
  updateEvent: (
    id: string,
    input: CalendarEventInput,
  ) => ApiResponse<{ id: string }>;
  deleteEvent: (id: string) => ApiResponse<void>;
}
