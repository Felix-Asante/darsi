import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IGradingService } from "./interface";

export function createGradingService(http: HttpClient): IGradingService {
  const { grading } = apiEndpoints;
  return {
    presets: (config) => http.get(grading.presets(), undefined, config),
    listScales: (config) => http.get(grading.scales(), undefined, config),
    createScale: (input) => http.post(grading.scales(), input),
    updateScale: (id, input) => http.put(grading.scale(id), input),
    listConversions: (config) =>
      http.get(grading.conversions(), undefined, config),
    saveConversion: (input) => http.put(grading.conversions(), input),
    convert: (input) =>
      http.post(grading.convert(), input, { isRetryable: true }),
    listPolicies: (config) => http.get(grading.policies(), undefined, config),
    savePolicy: (input) => http.put(grading.policies(), input),
  };
}
