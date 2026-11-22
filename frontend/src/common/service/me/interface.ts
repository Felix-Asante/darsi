import type { ApiResponse } from "@/common/types/api";
import type { Me } from "@/common/types/identity";
import type { RequestConfig } from "../http.service";

export interface IMeService {
  /** GET — the signed-in user, their schools and the current one. 401 when signed out. */
  get: (config?: RequestConfig) => ApiResponse<Me>;
}
