import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IAttendanceService } from "./interface";

export function createAttendanceService(http: HttpClient): IAttendanceService {
  const { attendance } = apiEndpoints;
  return {
    settings: (config) => http.get(attendance.settings(), undefined, config),
    saveSettings: (input) => http.put(attendance.settings(), input),
    statuses: (config) => http.get(attendance.statuses(), undefined, config),
    createStatus: (input) => http.post(attendance.statuses(), input),
    deleteStatus: (code) => http.delete(attendance.status(code)),
    sheet: (classId, date, periodId, config) =>
      http.get(
        attendance.sheet(classId, { date, periodId }),
        undefined,
        config,
      ),
    take: (classId, input) => http.put(attendance.sheet(classId), input),
    studentSummary: (studentId, from, to, config) =>
      http.get(attendance.summary(studentId, { from, to }), undefined, config),
    explain: (studentId, input) =>
      http.post(attendance.reasons(studentId), input),
    report: (query, config) =>
      http.get(attendance.report(query), undefined, config),
    reportCsv: (query) =>
      http.get(attendance.reportCsv(query), undefined, {
        responseType: "blob",
      }),
  };
}
