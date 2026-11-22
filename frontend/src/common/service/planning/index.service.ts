import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IPlanningService } from "./interface";

export function createPlanningService(http: HttpClient): IPlanningService {
  const { planning } = apiEndpoints;
  return {
    templates: (config) => http.get(planning.templates(), undefined, config),
    saveTemplate: (input, id) =>
      id
        ? http.put(planning.template(id), input)
        : http.post(planning.templates(), input),
    mine: (config) => http.get(planning.units(), undefined, config),
    forClass: (classId, config) =>
      http.get(planning.forClass(classId), undefined, config),
    get: (id, config) => http.get(planning.unit(id), undefined, config),
    create: (input) => http.post(planning.units(), input),
    update: (id, input) => http.put(planning.unit(id), input),
    remove: (id) => http.delete(planning.unit(id)),
    setCollaborators: (id, collaborators) =>
      http.put(planning.collaborators(id), { collaborators }),
    linkAssessments: (id, assessmentIds) =>
      http.put(planning.assessments(id), { assessmentIds }),
    copy: (id, input) => http.post(planning.copy(id), input),
    saveLesson: (unitId, input, lessonId) =>
      lessonId
        ? http.put(planning.lesson(unitId, lessonId), input)
        : http.post(planning.lessons(unitId), input),
    removeLesson: (unitId, lessonId) =>
      http.delete(planning.lesson(unitId, lessonId)),
  };
}
