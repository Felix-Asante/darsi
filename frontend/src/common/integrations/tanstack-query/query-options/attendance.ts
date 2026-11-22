import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import type { ReportQuery } from "@/common/service/attendance/interface";
import { queryKeys } from "../query-keys";

export const getAttendanceSettingsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.attendance.settings(),
    queryFn: ({ signal }) =>
      api.attendance.settings({ signal }).then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

export const getAttendanceStatusesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.attendance.statuses(),
    queryFn: ({ signal }) =>
      api.attendance.statuses({ signal }).then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

export const getAttendanceSheetQueryOptions = (
  classId: string,
  date: string,
  periodId?: string,
) =>
  queryOptions({
    queryKey: queryKeys.attendance.sheet(classId, date, periodId),
    queryFn: ({ signal }) =>
      api.attendance
        .sheet(classId, date, periodId, { signal })
        .then((response) => response.data),
  });

export const getStudentAttendanceQueryOptions = (
  studentId: string,
  from: string,
  to: string,
) =>
  queryOptions({
    queryKey: queryKeys.attendance.summary(studentId, from, to),
    queryFn: ({ signal }) =>
      api.attendance
        .studentSummary(studentId, from, to, { signal })
        .then((response) => response.data),
    enabled: Boolean(studentId),
  });

export const getAttendanceReportQueryOptions = (query: ReportQuery) =>
  queryOptions({
    queryKey: queryKeys.attendance.report(query),
    queryFn: ({ signal }) =>
      api.attendance
        .report(query, { signal })
        .then((response) => response.data),
    placeholderData: (previous) => previous,
  });
