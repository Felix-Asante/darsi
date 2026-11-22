import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, monthGrid } from "@/common/lib/calendar-date";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getCalendarItemsQueryOptions } from "@/common/integrations/tanstack-query/query-options/calendar";
import { api } from "@/common/service/api";
import type { CalendarEventInput } from "@/common/types/calendar";

/** Items for every day shown in the month grid, including the spill-over days of nearby months. */
export function useCalendar(month: string) {
  const queryClient = useQueryClient();
  const weeks = monthGrid(month);
  const from = weeks[0][0];
  const to = weeks.at(-1)!.at(-1)!;
  const items = useQuery(getCalendarItemsQueryOptions(from, to));
  // Holidays and closures change timetables.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timetables.all() }),
    ]);

  const createEvent = useMutation({
    mutationFn: (input: CalendarEventInput) => api.calendar.createEvent(input),
    onSuccess: refresh,
  });
  const deleteEvent = useMutation({ mutationFn: (id: string) => api.calendar.deleteEvent(id), onSuccess: refresh });

  return { weeks, items, createEvent, deleteEvent, previous: addMonths(month, -1), next: addMonths(month, 1), from, to };
}

/** Whether an item covers a day, for multi-day events. */
export const coversDay = (item: { startsOn: string; endsOn: string }, day: string) =>
  item.startsOn <= day && item.endsOn >= day;
