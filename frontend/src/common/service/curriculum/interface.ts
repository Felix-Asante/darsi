import type { Framework, StandardNode } from "@/common/types/academics";
import type { ApiResponse } from "@/common/types/api";
import type { RequestConfig } from "../http.service";

export interface ICurriculumService {
  listFrameworks: (config?: RequestConfig) => ApiResponse<Framework[]>;
  createFramework: (input: {
    code: string;
    name: string;
    description?: string | null;
  }) => ApiResponse<Framework>;
  standards: (
    frameworkId: string,
    config?: RequestConfig,
  ) => ApiResponse<StandardNode[]>;
}
