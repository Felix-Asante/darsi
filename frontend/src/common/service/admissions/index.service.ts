import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IAdmissionsService } from "./interface";

export function createAdmissionsService(http: HttpClient): IAdmissionsService {
  const { admissions } = apiEndpoints;
  return {
    publicPage: (config) =>
      http.get(admissions.publicPage(), undefined, config),
    join: () => http.post(admissions.join(), undefined, { isRetryable: true }),

    myApplications: (config) =>
      http.get(admissions.myApplications(), undefined, config),
    myApplication: (id, config) =>
      http.get(admissions.myApplication(id), undefined, config),
    createApplication: (input) => http.post(admissions.myApplications(), input),
    updateApplication: (id, input) =>
      http.put(admissions.myApplication(id), input),
    deleteApplication: (id) => http.delete(admissions.myApplication(id)),
    attachDocument: (id, key, fileId) =>
      http.put(admissions.document(id, key), { fileId }),
    submitApplication: (id) => http.post(admissions.submit(id)),
    respondToOffer: (id, response) =>
      http.post(admissions.offer(id), { response }),

    cycles: (config) => http.get(admissions.cycles(), undefined, config),
    saveCycle: (input, id) =>
      id
        ? http.put(admissions.cycle(id), input)
        : http.post(admissions.cycles(), input),
    places: (id, config) => http.get(admissions.places(id), undefined, config),
    forms: (config) => http.get(admissions.forms(), undefined, config),
    saveForm: (input) => http.put(admissions.forms(), input),
    stages: (config) => http.get(admissions.stages(), undefined, config),
    saveStages: (stages) => http.put(admissions.stages(), { stages }),

    applications: (query, config) =>
      http.get(admissions.applications(query), undefined, config),
    application: (id, config) =>
      http.get(admissions.application(id), undefined, config),
    move: (id, stageId, offerExpiresOn) =>
      http.post(admissions.move(id), {
        stageId,
        ...(offerExpiresOn ? { offerExpiresOn } : {}),
      }),
    addNote: (id, input) => http.post(admissions.notes(id), input),

    reEnrolments: (academicYearId, config) =>
      http.get(admissions.reEnrolments(academicYearId), undefined, config),
    startReEnrolment: (academicYearId) =>
      http.post(admissions.reEnrolments(), { academicYearId }),
    applyReEnrolment: (academicYearId) =>
      http.post(admissions.applyReEnrolment(), { academicYearId }),
    myReEnrolments: (config) =>
      http.get(admissions.myReEnrolments(), undefined, config),
    respondReEnrolment: (id, response) =>
      http.post(admissions.respondReEnrolment(id), { response }),
    withdraw: (studentId, input) =>
      http.post(admissions.withdrawal(studentId), input),
  };
}
