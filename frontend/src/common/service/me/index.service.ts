import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IMeService } from "./interface";

export function createMeService(http: HttpClient): IMeService {
  return {
    get: (config) =>
      http.get(apiEndpoints.me.get(), undefined, {
        ...config,
        isRetryable: false,
      }),
  };
}
