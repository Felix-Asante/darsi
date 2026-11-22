import type {
  AcademicYear,
  AcademicYearInput,
  ClassInput,
  ClassStaffRole,
  Division,
  GradeLevel,
  SchoolClass,
  Subject,
} from "@/common/types/academics";
import type { ApiResponse } from "@/common/types/api";
import type { Term } from "@/common/types/calendar";
import type { StudentSummary } from "@/common/types/people";
import type { RequestConfig } from "../http.service";

export interface IAcademicsService {
  listYears: (config?: RequestConfig) => ApiResponse<AcademicYear[]>;
  createYear: (input: AcademicYearInput) => ApiResponse<AcademicYear>;
  updateYear: (
    id: string,
    input: Partial<AcademicYearInput>,
  ) => ApiResponse<AcademicYear>;
  makeCurrent: (id: string) => ApiResponse<AcademicYear>;
  listTerms: (yearId: string, config?: RequestConfig) => ApiResponse<Term[]>;
  createTerm: (
    yearId: string,
    input: Pick<Term, "name" | "startsOn" | "endsOn">,
  ) => ApiResponse<Term>;
  deleteTerm: (id: string) => ApiResponse<void>;

  listDivisions: (config?: RequestConfig) => ApiResponse<Division[]>;
  createDivision: (input: { name: string }) => ApiResponse<Division>;
  updateDivision: (
    id: string,
    input: { name: string },
  ) => ApiResponse<Division>;
  deleteDivision: (id: string) => ApiResponse<void>;
  createGradeLevel: (input: {
    divisionId: string;
    name: string;
  }) => ApiResponse<GradeLevel>;
  updateGradeLevel: (
    id: string,
    input: { divisionId: string; name: string },
  ) => ApiResponse<GradeLevel>;
  deleteGradeLevel: (id: string) => ApiResponse<void>;

  listSubjects: (config?: RequestConfig) => ApiResponse<Subject[]>;
  createSubject: (input: Omit<Subject, "id">) => ApiResponse<Subject>;
  updateSubject: (
    id: string,
    input: Omit<Subject, "id">,
  ) => ApiResponse<Subject>;

  /** Teachers, assistants and class members only see their own classes. */
  listClasses: (
    query?: { academicYearId?: string; mine?: boolean },
    config?: RequestConfig,
  ) => ApiResponse<SchoolClass[]>;
  getClass: (id: string, config?: RequestConfig) => ApiResponse<SchoolClass>;
  createClass: (input: ClassInput) => ApiResponse<SchoolClass>;
  updateClass: (
    id: string,
    input: Partial<Omit<ClassInput, "academicYearId">>,
  ) => ApiResponse<SchoolClass>;
  setStaff: (
    id: string,
    staff: { userId: string; role: ClassStaffRole }[],
  ) => ApiResponse<SchoolClass>;

  roster: (
    classId: string,
    config?: RequestConfig,
  ) => ApiResponse<StudentSummary[]>;
  enrol: (
    classId: string,
    studentIds: string[],
  ) => ApiResponse<StudentSummary[]>;
  unenrol: (classId: string, studentId: string) => ApiResponse<void>;
}
