import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IAnnouncementsService } from "./interface";

export function createAnnouncementsService(
  http: HttpClient,
): IAnnouncementsService {
  const { announcements } = apiEndpoints;
  return {
    feed: (cursor, config) =>
      http.get(announcements.feed(cursor), undefined, config),
    scheduled: (config) =>
      http.get(announcements.scheduled(), undefined, config),
    create: (input) => http.post(announcements.feed(), input),
    remove: (id) => http.delete(announcements.one(id)),
    classSettings: (classId, config) =>
      http.get(announcements.classSettings(classId), undefined, config),
    saveClassSettings: (classId, assistantsCanPost) =>
      http.put(announcements.classSettings(classId), { assistantsCanPost }),
  };
}
