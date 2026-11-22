import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { ICurriculumService } from "./interface";

export function createCurriculumService(http: HttpClient): ICurriculumService {
  const { curriculum } = apiEndpoints;
  return {
    listFrameworks: (config) =>
      http.get(curriculum.frameworks(), undefined, config),
    createFramework: (input) => http.post(curriculum.frameworks(), input),
    standards: (frameworkId, config) =>
      http.get(curriculum.standards(frameworkId), undefined, config),
  };
}
