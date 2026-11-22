import {
  addDays,
  daysBetween,
  eachDay,
  isoWeekday,
} from '../../common/dates/calendar-date.js';

/**
 * How a bell schedule's days repeat:
 * - `weekly`: the same weekday each week, alternating over `weeks` weeks (Week A / Week B).
 *   Holidays do not shift the weeks.
 * - `cycle`: day 1, 2 … `days`, advancing one per school day. Holidays and
 *   closures do not use up a cycle day, as schools with day 1–6 cycles expect.
 */
export type Rotation =
  { kind: 'weekly'; weeks: number } | { kind: 'cycle'; days: number };

export interface RotationCalendar {
  /** The first day of the academic year: day 1 of Week A, or cycle day 1. */
  anchor: string;
  /** ISO weekdays that are school days (1 for Monday), in week order: `[7, 1, 2, 3, 4]` starts on Sunday. */
  weekdays: number[];
  /** Holidays and closures for this schedule. */
  isDayOff: (date: string) => boolean;
}

export function cycleLength(rotation: Rotation, weekdays: number[]): number {
  return rotation.kind === 'weekly'
    ? rotation.weeks * weekdays.length
    : rotation.days;
}

/** The cycle day (1-based) of each date in `from`–`to`, or null when there is no school. */
export function cycleDays(
  from: string,
  to: string,
  rotation: Rotation,
  calendar: RotationCalendar,
): Map<string, number | null> {
  const { weekdays } = calendar;
  const weekStart = (date: string) =>
    addDays(date, -((isoWeekday(date) - weekdays[0] + 7) % 7));
  const isSchoolDay = (date: string) =>
    date >= calendar.anchor &&
    weekdays.includes(isoWeekday(date)) &&
    !calendar.isDayOff(date);
  const result = new Map<string, number | null>();

  if (rotation.kind === 'weekly') {
    for (const date of eachDay(from, to)) {
      if (!isSchoolDay(date)) {
        result.set(date, null);
        continue;
      }
      const week =
        Math.floor(
          daysBetween(weekStart(calendar.anchor), weekStart(date)) / 7,
        ) % rotation.weeks;
      result.set(
        date,
        week * weekdays.length + weekdays.indexOf(isoWeekday(date)) + 1,
      );
    }
    return result;
  }

  let schoolDays = 0;
  const start = calendar.anchor < from ? calendar.anchor : from;
  for (const date of eachDay(start, to)) {
    const counts = isSchoolDay(date);
    if (counts) schoolDays += 1;
    if (date >= from)
      result.set(date, counts ? ((schoolDays - 1) % rotation.days) + 1 : null);
  }
  return result;
}
