import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IPortfolioService } from "./interface";

export function createPortfolioService(http: HttpClient): IPortfolioService {
  const { portfolio } = apiEndpoints;
  return {
    overview: (studentId, config) =>
      http.get(portfolio.overview(studentId), undefined, config),
    items: (studentId, cursor, config) =>
      http.get(portfolio.items(studentId, cursor), undefined, config),
    classItems: (classId, cursor, config) =>
      http.get(portfolio.classItems(classId, cursor), undefined, config),
    add: (input) => http.post(portfolio.add(), input),
    approve: (id) =>
      http.post(portfolio.approve(id), undefined, { isRetryable: true }),
    remove: (id) => http.delete(portfolio.item(id)),
    comment: (id, body) => http.post(portfolio.comments(id), { body }),
    settings: (config) => http.get(portfolio.settings(), undefined, config),
    saveSettings: (approvalRequired) =>
      http.put(portfolio.settings(), { approvalRequired }),
  };
}
