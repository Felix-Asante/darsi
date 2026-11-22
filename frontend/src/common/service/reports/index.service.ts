import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IReportsService } from "./interface";

export function createReportsService(http: HttpClient): IReportsService {
  const { reports } = apiEndpoints;
  return {
    templates: (config) => http.get(reports.templates(), undefined, config),
    saveTemplate: (input) => http.put(reports.templates(), input),
    open: (termId, input) =>
      http.post(reports.open(termId), input, { isRetryable: true }),
    cards: (termId, config) =>
      http.get(reports.cards(termId), undefined, config),
    classSheet: (termId, classId, config) =>
      http.get(reports.classSheet(termId, classId), undefined, config),
    saveComments: (termId, classId, comments) =>
      http.put(reports.classSheet(termId, classId), { comments }),
    card: (id, config) => http.get(reports.card(id), undefined, config),
    setGeneralComment: (id, generalComment) =>
      http.put(reports.generalComment(id), { generalComment }),
    returnForEdits: (id, note) =>
      http.post(reports.returnForEdits(id), { note }),
    approve: (id) =>
      http.post(reports.approve(id), undefined, { isRetryable: true }),
  };
}
