import type { ApiResponse } from "@/common/types/api";
import type {
  Assessment,
  AssessmentInput,
  GradeEntry,
  Gradebook,
  GradingSheet,
  StudentClassGrades,
} from "@/common/types/assessment";
import type { RequestConfig } from "../http.service";

export interface IAssessmentService {
  listForClass: (
    classId: string,
    config?: RequestConfig,
  ) => ApiResponse<Assessment[]>;
  create: (classId: string, input: AssessmentInput) => ApiResponse<Assessment>;
  remove: (id: string) => ApiResponse<void>;
  sheet: (id: string, config?: RequestConfig) => ApiResponse<GradingSheet>;
  /** Drafts unless `publish`; publishing needs the class's teacher. */
  saveGrades: (
    id: string,
    input: { grades: GradeEntry[]; publish?: boolean },
  ) => ApiResponse<GradingSheet>;
  publishAll: (id: string) => ApiResponse<GradingSheet>;
  gradebook: (
    classId: string,
    termId?: string,
    config?: RequestConfig,
  ) => ApiResponse<Gradebook>;
  studentGrades: (
    studentId: string,
    termId?: string,
    config?: RequestConfig,
  ) => ApiResponse<StudentClassGrades[]>;
  submit: (
    id: string,
    body: string,
  ) => ApiResponse<{ body: string; submittedAt: string; isLate: boolean }>;
}
