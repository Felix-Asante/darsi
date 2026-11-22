import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IAssessmentService } from "./interface";

export function createAssessmentService(http: HttpClient): IAssessmentService {
  const { assessment } = apiEndpoints;
  return {
    listForClass: (classId, config) =>
      http.get(assessment.forClass(classId), undefined, config),
    create: (classId, input) => http.post(assessment.forClass(classId), input),
    remove: (id) => http.delete(assessment.one(id)),
    sheet: (id, config) => http.get(assessment.grades(id), undefined, config),
    saveGrades: (id, input) => http.put(assessment.grades(id), input),
    publishAll: (id) =>
      http.post(assessment.publish(id), undefined, { isRetryable: true }),
    gradebook: (classId, termId, config) =>
      http.get(assessment.gradebook(classId, termId), undefined, config),
    studentGrades: (studentId, termId, config) =>
      http.get(assessment.studentGrades(studentId, termId), undefined, config),
    submit: (id, body) => http.put(assessment.submission(id), { body }),
  };
}
