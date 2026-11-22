import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { ISchoolService } from "./interface";

export function createSchoolService(http: HttpClient): ISchoolService {
  const { school } = apiEndpoints;
  return {
    getCurrent: () => http.get(school.current()),
    update: (input) => http.patch(school.current(), input),
    completeOnboarding: (input) => http.post(school.onboarding(), input),
  };
}
