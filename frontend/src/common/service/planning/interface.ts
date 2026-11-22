import type { ApiResponse } from "@/common/types/api";
import type {
  LessonInput,
  PlanTemplate,
  TemplateField,
  UnitInput,
  UnitPlan,
  UnitSummary,
} from "@/common/types/daily";
import type { RequestConfig } from "../http.service";

export interface IPlanningService {
  templates: (config?: RequestConfig) => ApiResponse<PlanTemplate[]>;
  saveTemplate: (
    input: { name: string; fields: TemplateField[] },
    id?: string,
  ) => ApiResponse<PlanTemplate>;
  mine: (config?: RequestConfig) => ApiResponse<UnitSummary[]>;
  forClass: (
    classId: string,
    config?: RequestConfig,
  ) => ApiResponse<UnitSummary[]>;
  get: (id: string, config?: RequestConfig) => ApiResponse<UnitPlan>;
  create: (input: UnitInput) => ApiResponse<UnitPlan>;
  update: (id: string, input: UnitInput) => ApiResponse<UnitPlan>;
  remove: (id: string) => ApiResponse<void>;
  setCollaborators: (
    id: string,
    collaborators: { userId: string; role: "editor" | "viewer" }[],
  ) => ApiResponse<UnitPlan>;
  linkAssessments: (
    id: string,
    assessmentIds: string[],
  ) => ApiResponse<UnitPlan>;
  copy: (
    id: string,
    input: { classIds: string[]; shiftDays?: number },
  ) => ApiResponse<UnitPlan>;
  saveLesson: (
    unitId: string,
    input: LessonInput,
    lessonId?: string,
  ) => ApiResponse<UnitPlan>;
  removeLesson: (unitId: string, lessonId: string) => ApiResponse<void>;
}
