import type { SchoolClass } from "./academics";

export const EVENT_KINDS = ["holiday", "closure", "exam", "event"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const AUDIENCES = [
  "school",
  "division",
  "grade_level",
  "class",
] as const;
export type AudienceKind = (typeof AUDIENCES)[number];

/** One entry on a calendar: an event occurrence, or an item from another module (due dates). */
export interface CalendarItem {
  id: string;
  source: string;
  kind: string;
  title: string;
  description: string | null;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  eventId?: string;
  recurring?: boolean;
  link?: string;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  kind: EventKind;
  startsOn: string;
  endsOn?: string;
  startTime?: string | null;
  endTime?: string | null;
  recurrence?: string | null;
  audience: AudienceKind;
  audienceId?: string | null;
}

export interface Term {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface Period {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
}

export type RotationKind = "weekly" | "cycle";

export interface BellSchedule {
  id: string;
  divisionId: string | null;
  name: string;
  rotationKind: RotationKind;
  rotationLength: number;
  weekdays: number[];
  cycleLength: number;
  periods: Period[];
}

export interface BellScheduleInput {
  divisionId: string | null;
  name: string;
  rotationKind: RotationKind;
  rotationLength: number;
  weekdays?: number[];
}

export interface TimetableSlot {
  id: string;
  classId: string;
  cycleDay: number;
  room: string | null;
  teacherUserId: string | null;
  period: Period;
}

export interface Lesson {
  date: string;
  cycleDay: number;
  slotId: string;
  room: string | null;
  period: Period;
  class: Pick<SchoolClass, "id" | "code" | "name" | "subject">;
  teachers: string[];
}
