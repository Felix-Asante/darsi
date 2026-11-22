import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IAcademicsService } from "./interface";

export function createAcademicsService(http: HttpClient): IAcademicsService {
  const { academics } = apiEndpoints;
  return {
    listYears: (config) => http.get(academics.years(), undefined, config),
    createYear: (input) => http.post(academics.years(), input),
    updateYear: (id, input) => http.patch(academics.year(id), input),
    makeCurrent: (id) =>
      http.post(academics.makeCurrent(id), undefined, { isRetryable: true }),
    listTerms: (yearId, config) =>
      http.get(academics.terms(yearId), undefined, config),
    createTerm: (yearId, input) => http.post(academics.terms(yearId), input),
    deleteTerm: (id) => http.delete(academics.term(id)),

    listDivisions: (config) =>
      http.get(academics.divisions(), undefined, config),
    createDivision: (input) => http.post(academics.divisions(), input),
    updateDivision: (id, input) => http.patch(academics.division(id), input),
    deleteDivision: (id) => http.delete(academics.division(id)),
    createGradeLevel: (input) => http.post(academics.gradeLevels(), input),
    updateGradeLevel: (id, input) =>
      http.patch(academics.gradeLevel(id), input),
    deleteGradeLevel: (id) => http.delete(academics.gradeLevel(id)),

    listSubjects: (config) => http.get(academics.subjects(), undefined, config),
    createSubject: (input) => http.post(academics.subjects(), input),
    updateSubject: (id, input) => http.patch(academics.subject(id), input),

    listClasses: ({ academicYearId, mine } = {}, config) =>
      http.get(
        academics.classes({ academicYearId, mine: mine ? "true" : undefined }),
        undefined,
        config,
      ),
    getClass: (id, config) => http.get(academics.class(id), undefined, config),
    createClass: (input) => http.post(academics.classes(), input),
    updateClass: (id, input) => http.patch(academics.class(id), input),
    setStaff: (id, staff) => http.put(academics.classStaff(id), { staff }),

    roster: (classId, config) =>
      http.get(academics.roster(classId), undefined, config),
    enrol: (classId, studentIds) =>
      http.post(academics.roster(classId), { studentIds }),
    unenrol: (classId, studentId) =>
      http.delete(academics.enrolment(classId, studentId)),
  };
}
