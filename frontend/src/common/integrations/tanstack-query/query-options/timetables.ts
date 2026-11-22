import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

/** Without a student, the signed-in user's own timetable. */
export const getLessonsQueryOptions = (
  from: string,
  to: string,
  studentId?: string,
) =>
  queryOptions({
    queryKey: studentId
      ? queryKeys.timetables.student(studentId, from, to)
      : queryKeys.timetables.mine(from, to),
    queryFn: ({ signal }) =>
      (studentId
        ? api.timetables.forStudent(studentId, { from, to }, { signal })
        : api.timetables.mine({ from, to }, { signal })
      ).then((response) => response.data),
    placeholderData: (previous) => previous,
  });

export const getClassSlotsQueryOptions = (classId: string) =>
  queryOptions({
    queryKey: queryKeys.timetables.classSlots(classId),
    queryFn: ({ signal }) =>
      api.timetables
        .classSlots(classId, { signal })
        .then((response) => response.data),
  });

export const getBellSchedulesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.timetables.schedules(),
    queryFn: ({ signal }) =>
      api.timetables
        .listSchedules({ signal })
        .then((response) => response.data),
  });
