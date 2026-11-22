import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getDivisionsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getBellSchedulesQueryOptions } from "@/common/integrations/tanstack-query/query-options/timetables";
import { api } from "@/common/service/api";
import type { BellScheduleInput, Period } from "@/common/types/calendar";

export function useBellSchedules() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.timetables.all() });
  return {
    schedules: useQuery(getBellSchedulesQueryOptions()),
    divisions: useQuery(getDivisionsQueryOptions()),
    createSchedule: useMutation({
      mutationFn: (input: BellScheduleInput) => api.timetables.createSchedule(input).then((response) => response.data),
      onSuccess: refresh,
    }),
    deleteSchedule: useMutation({ mutationFn: (id: string) => api.timetables.deleteSchedule(id), onSuccess: refresh }),
    createPeriod: useMutation({
      mutationFn: ({ scheduleId, ...input }: Omit<Period, "id" | "sortOrder"> & { scheduleId: string }) =>
        api.timetables.createPeriod(scheduleId, input),
      onSuccess: refresh,
    }),
    deletePeriod: useMutation({ mutationFn: (id: string) => api.timetables.deletePeriod(id), onSuccess: refresh }),
  };
}
