import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { ITimetablesService } from "./interface";

export function createTimetablesService(http: HttpClient): ITimetablesService {
  const { timetables } = apiEndpoints;
  return {
    mine: (range, config) =>
      http.get(timetables.mine(range), undefined, config),
    forStudent: (studentId, range, config) =>
      http.get(timetables.student(studentId, range), undefined, config),

    classSlots: (classId, config) =>
      http.get(timetables.classSlots(classId), undefined, config),
    createSlot: (classId, input) =>
      http.post(timetables.classSlots(classId), input),
    deleteSlot: (classId, slotId) =>
      http.delete(timetables.classSlot(classId, slotId)),

    listSchedules: (config) =>
      http.get(timetables.schedules(), undefined, config),
    createSchedule: (input) => http.post(timetables.schedules(), input),
    updateSchedule: (id, input) => http.patch(timetables.schedule(id), input),
    deleteSchedule: (id) => http.delete(timetables.schedule(id)),
    createPeriod: (scheduleId, input) =>
      http.post(timetables.periods(scheduleId), input),
    deletePeriod: (id) => http.delete(timetables.period(id)),
  };
}
