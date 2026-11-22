import type { ApiResponse } from "@/common/types/api";
import type { RequestConfig } from "../http.service";

export type HealthStatus = "ok" | "error" | "degraded" | "shutting_down";

export interface HealthReport {
  status: HealthStatus;
  details: Record<
    string,
    { status: "up" | "down" | "degraded"; message?: string }
  >;
}

export interface IHealthService {
  /** GET — whether the API and its database and Redis can serve requests. */
  getReadiness: (config?: RequestConfig) => ApiResponse<HealthReport>;
}
