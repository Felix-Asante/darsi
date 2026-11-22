import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IPeopleService } from "./interface";

export function createPeopleService(http: HttpClient): IPeopleService {
  const { people } = apiEndpoints;
  return {
    listStudents: (query, config) =>
      http.get(people.students(query), undefined, config),
    mine: (config) => http.get(people.mine(), undefined, config),
    getStudent: (id, config) => http.get(people.student(id), undefined, config),
    createStudent: (input) => http.post(people.students(), input),
    updateStudent: (id, input) => http.patch(people.student(id), input),
    linkGuardian: (studentId, input) =>
      http.post(people.studentGuardians(studentId), input),
    unlinkGuardian: (studentId, guardianId) =>
      http.delete(people.studentGuardian(studentId, guardianId)),

    listGuardians: (search, config) =>
      http.get(people.guardians({ search }), undefined, config),
    createGuardian: (input) => http.post(people.guardians(), input),
    updateGuardian: (id, input) => http.patch(people.guardian(id), input),
  };
}
