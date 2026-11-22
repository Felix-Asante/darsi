import type { ApiResponse } from "@/common/types/api";
import type {
  AdmissionForm,
  ApplicationInput,
  ApplicationSummary,
  Cycle,
  FamilyApplication,
  PublicAdmissions,
  ReEnrolmentEntry,
  Stage,
  StaffApplication,
} from "@/common/types/admissions";
import type { RequestConfig } from "../http.service";

export type CycleInput = Omit<Cycle, "id">;
export type StageInput = Pick<Stage, "name" | "kind" | "email"> & {
  id?: string;
};

export interface IAdmissionsService {
  publicPage: (config?: RequestConfig) => ApiResponse<PublicAdmissions>;
  join: () => ApiResponse<{ roles: string[] }>;

  myApplications: (config?: RequestConfig) => ApiResponse<FamilyApplication[]>;
  myApplication: (
    id: string,
    config?: RequestConfig,
  ) => ApiResponse<FamilyApplication>;
  createApplication: (
    input: ApplicationInput,
  ) => ApiResponse<FamilyApplication>;
  updateApplication: (
    id: string,
    input: ApplicationInput,
  ) => ApiResponse<FamilyApplication>;
  deleteApplication: (id: string) => ApiResponse<void>;
  attachDocument: (
    id: string,
    key: string,
    fileId: string,
  ) => ApiResponse<FamilyApplication>;
  submitApplication: (id: string) => ApiResponse<FamilyApplication>;
  respondToOffer: (
    id: string,
    response: "accepted" | "declined",
  ) => ApiResponse<FamilyApplication>;

  cycles: (config?: RequestConfig) => ApiResponse<Cycle[]>;
  saveCycle: (input: CycleInput, id?: string) => ApiResponse<Cycle>;
  places: (
    id: string,
    config?: RequestConfig,
  ) => ApiResponse<
    Omit<Cycle, "grades"> & {
      grades: { gradeLevelId: string; places: number; taken: number }[];
    }
  >;
  forms: (config?: RequestConfig) => ApiResponse<AdmissionForm[]>;
  saveForm: (input: Omit<AdmissionForm, "id">) => ApiResponse<AdmissionForm>;
  stages: (config?: RequestConfig) => ApiResponse<Stage[]>;
  saveStages: (stages: StageInput[]) => ApiResponse<Stage[]>;

  applications: (
    query: { cycleId?: string; stageId?: string; gradeLevelId?: string },
    config?: RequestConfig,
  ) => ApiResponse<ApplicationSummary[]>;
  application: (
    id: string,
    config?: RequestConfig,
  ) => ApiResponse<StaffApplication>;
  move: (
    id: string,
    stageId: string,
    offerExpiresOn?: string,
  ) => ApiResponse<StaffApplication>;
  addNote: (
    id: string,
    input: {
      kind: "note" | "rating" | "interview";
      body: string;
      rating?: number;
    },
  ) => ApiResponse<StaffApplication>;

  reEnrolments: (
    academicYearId: string,
    config?: RequestConfig,
  ) => ApiResponse<ReEnrolmentEntry[]>;
  startReEnrolment: (
    academicYearId: string,
  ) => ApiResponse<{ created: number; skipped: number }>;
  applyReEnrolment: (
    academicYearId: string,
  ) => ApiResponse<{ applied: number }>;
  myReEnrolments: (config?: RequestConfig) => ApiResponse<ReEnrolmentEntry[]>;
  respondReEnrolment: (
    id: string,
    response: "confirmed" | "declined",
  ) => ApiResponse<ReEnrolmentEntry>;
  withdraw: (
    studentId: string,
    input: { leavingOn: string; reason: string },
  ) => ApiResponse<void>;
}
