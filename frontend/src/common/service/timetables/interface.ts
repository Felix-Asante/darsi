import type { ApiResponse } from "@/common/types/api";
import type {
  BellSchedule,
  BellScheduleInput,
  Lesson,
  Period,
  TimetableSlot,
} from "@/common/types/calendar";
import type { RequestConfig } from "../http.service";

type Range = { from: string; to: string };

export interface ITimetablesService {
  /** Lessons of the classes the user teaches, supports or attends (at most 42 days). */
  mine: (range: Range, config?: RequestConfig) => ApiResponse<Lesson[]>;
  forStudent: (
    studentId: string,
    range: Range,
    config?: RequestConfig,
  ) => ApiResponse<Lesson[]>;

  classSlots: (
    classId: string,
    config?: RequestConfig,
  ) => ApiResponse<{ schedule: BellSchedule | null; slots: TimetableSlot[] }>;
  createSlot: (
    classId: string,
    input: { periodId: string; cycleDay: number; room?: string | null },
  ) => ApiResponse<TimetableSlot>;
  deleteSlot: (classId: string, slotId: string) => ApiResponse<void>;

  listSchedules: (config?: RequestConfig) => ApiResponse<BellSchedule[]>;
  createSchedule: (input: BellScheduleInput) => ApiResponse<BellSchedule>;
  updateSchedule: (
    id: string,
    input: BellScheduleInput,
  ) => ApiResponse<BellSchedule>;
  deleteSchedule: (id: string) => ApiResponse<void>;
  createPeriod: (
    scheduleId: string,
    input: Omit<Period, "id" | "sortOrder">,
  ) => ApiResponse<Period>;
  deletePeriod: (id: string) => ApiResponse<void>;
}
