import type { ApiResponse } from "@/common/types/api";
import type {
  AttendanceSettings,
  AttendanceSheet,
  AttendanceStatus,
  ReportLine,
  StudentAttendance,
} from "@/common/types/daily";
import type { RequestConfig } from "../http.service";

export type ReportQuery = {
  from: string;
  to: string;
  classId?: string;
  gradeLevelId?: string;
};

export interface IAttendanceService {
  settings: (config?: RequestConfig) => ApiResponse<AttendanceSettings>;
  saveSettings: (input: AttendanceSettings) => ApiResponse<AttendanceSettings>;
  statuses: (config?: RequestConfig) => ApiResponse<AttendanceStatus[]>;
  createStatus: (input: {
    code: string;
    label: string;
    countsAs: AttendanceStatus["countsAs"];
  }) => ApiResponse<AttendanceStatus>;
  deleteStatus: (code: string) => ApiResponse<void>;
  sheet: (
    classId: string,
    date: string,
    periodId?: string,
    config?: RequestConfig,
  ) => ApiResponse<AttendanceSheet>;
  /** Students left out are present. */
  take: (
    classId: string,
    input: {
      date: string;
      periodId?: string | null;
      records: { studentId: string; status: string; reason?: string | null }[];
    },
  ) => ApiResponse<AttendanceSheet>;
  studentSummary: (
    studentId: string,
    from: string,
    to: string,
    config?: RequestConfig,
  ) => ApiResponse<StudentAttendance>;
  explain: (
    studentId: string,
    input: { date: string; reason: string },
  ) => ApiResponse<{ date: string; reason: string }>;
  report: (
    query: ReportQuery,
    config?: RequestConfig,
  ) => ApiResponse<ReportLine[]>;
  reportCsv: (query: ReportQuery) => ApiResponse<Blob>;
}
