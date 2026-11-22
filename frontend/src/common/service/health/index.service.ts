import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IHealthService } from "./interface";

export function createHealthService(httpClient: HttpClient): IHealthService {
  return {
    getReadiness: (config) =>
      httpClient.get(apiEndpoints.health.ready(), undefined, {
        ...config,
        isRetryable: false,
      }),
  };
}
