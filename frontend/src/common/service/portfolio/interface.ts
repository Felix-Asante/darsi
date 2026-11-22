import type { ApiResponse, CursorPage } from "@/common/types/api";
import type {
  PortfolioItem,
  PortfolioItemInput,
  PortfolioOverview,
} from "@/common/types/portfolio";
import type { RequestConfig } from "../http.service";

export interface IPortfolioService {
  overview: (
    studentId: string,
    config?: RequestConfig,
  ) => ApiResponse<PortfolioOverview>;
  items: (
    studentId: string,
    cursor?: string,
    config?: RequestConfig,
  ) => ApiResponse<CursorPage<PortfolioItem>>;
  classItems: (
    classId: string,
    cursor?: string,
    config?: RequestConfig,
  ) => ApiResponse<CursorPage<PortfolioItem>>;
  add: (input: PortfolioItemInput) => ApiResponse<PortfolioItem>;
  approve: (id: string) => ApiResponse<void>;
  remove: (id: string) => ApiResponse<void>;
  comment: (id: string, body: string) => ApiResponse<PortfolioItem>;
  settings: (
    config?: RequestConfig,
  ) => ApiResponse<{ approvalRequired: boolean }>;
  saveSettings: (
    approvalRequired: boolean,
  ) => ApiResponse<{ approvalRequired: boolean }>;
}
