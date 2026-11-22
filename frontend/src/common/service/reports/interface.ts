import type { ApiResponse } from "@/common/types/api";
import type {
  ReportCardDetail,
  ReportCardSummary,
  ReportClassSheet,
  ReportTemplate,
} from "@/common/types/portfolio";
import type { RequestConfig } from "../http.service";

export interface IReportsService {
  templates: (config?: RequestConfig) => ApiResponse<ReportTemplate[]>;
  saveTemplate: (
    input: Omit<ReportTemplate, "id">,
  ) => ApiResponse<ReportTemplate>;
  open: (
    termId: string,
    input: { divisionId?: string | null; locale?: "en" | "fr" },
  ) => ApiResponse<{ students: number; entriesAdded: number }>;
  cards: (
    termId: string,
    config?: RequestConfig,
  ) => ApiResponse<ReportCardSummary[]>;
  classSheet: (
    termId: string,
    classId: string,
    config?: RequestConfig,
  ) => ApiResponse<ReportClassSheet>;
  saveComments: (
    termId: string,
    classId: string,
    comments: { studentId: string; comment: string | null }[],
  ) => ApiResponse<ReportClassSheet>;
  card: (id: string, config?: RequestConfig) => ApiResponse<ReportCardDetail>;
  setGeneralComment: (
    id: string,
    generalComment: string | null,
  ) => ApiResponse<ReportCardDetail>;
  returnForEdits: (id: string, note: string) => ApiResponse<ReportCardDetail>;
  approve: (id: string) => ApiResponse<ReportCardDetail>;
}
