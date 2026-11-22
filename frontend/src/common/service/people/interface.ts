import type { ApiResponse, CursorPage } from "@/common/types/api";
import type {
  GuardianInput,
  GuardianSummary,
  Relationship,
  StudentInput,
  StudentListQuery,
  StudentProfile,
  StudentSummary,
} from "@/common/types/people";
import type { RequestConfig } from "../http.service";

export interface IPeopleService {
  listStudents: (
    query?: StudentListQuery,
    config?: RequestConfig,
  ) => ApiResponse<CursorPage<StudentSummary>>;
  /** A guardian's children, or the signed-in student. */
  mine: (config?: RequestConfig) => ApiResponse<StudentSummary[]>;
  getStudent: (
    id: string,
    config?: RequestConfig,
  ) => ApiResponse<StudentProfile>;
  createStudent: (input: StudentInput) => ApiResponse<StudentProfile>;
  updateStudent: (
    id: string,
    input: Partial<StudentInput>,
  ) => ApiResponse<StudentProfile>;
  linkGuardian: (
    studentId: string,
    input: {
      guardianId: string;
      relationship: Relationship;
      isPrimaryContact?: boolean;
    },
  ) => ApiResponse<StudentProfile>;
  unlinkGuardian: (studentId: string, guardianId: string) => ApiResponse<void>;

  listGuardians: (
    search?: string,
    config?: RequestConfig,
  ) => ApiResponse<GuardianSummary[]>;
  createGuardian: (input: GuardianInput) => ApiResponse<GuardianSummary>;
  updateGuardian: (
    id: string,
    input: Partial<GuardianInput>,
  ) => ApiResponse<GuardianSummary>;
}
