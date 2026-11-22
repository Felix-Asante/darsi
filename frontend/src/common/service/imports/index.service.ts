import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IImportsService } from "./interface";

export function createImportsService(http: HttpClient): IImportsService {
  const { imports } = apiEndpoints;
  return {
    list: (config) => http.get(imports.list(), undefined, config),
    columns: (config) => http.get(imports.columns(), undefined, config),
    get: (id, config) => http.get(imports.job(id), undefined, config),
    create: (input) => http.post(imports.list(), input),
  };
}
