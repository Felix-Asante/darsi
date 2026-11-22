import type { ApiResponse } from "@/common/types/api";
import type {
  ImportColumns,
  ImportJob,
  ImportKind,
} from "@/common/types/people";
import type { RequestConfig } from "../http.service";

export interface IImportsService {
  list: (config?: RequestConfig) => ApiResponse<ImportJob[]>;
  columns: (config?: RequestConfig) => ApiResponse<ImportColumns>;
  get: (id: string, config?: RequestConfig) => ApiResponse<ImportJob>;
  /** Checks the header row, then queues the file. Rows are reported on the job. */
  create: (input: {
    kind: ImportKind;
    fileName: string;
    content: string;
  }) => ApiResponse<ImportJob>;
}
