/**
 * Calendar dates (`2026-11-19`) without a time zone, computed in UTC so no
 * offset shifts the day. "Today" is read in the school's time zone.
 */
const DAY_MS = 86_400_000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

export const addDays = (date: string, days: number) =>
  fromTime(toTime(date) + days * DAY_MS);

/** ISO weekday: 1 is Monday, 7 is Sunday. */
export const isoWeekday = (date: string) =>
  ((new Date(toTime(date)).getUTCDay() + 6) % 7) + 1;

export const startOfWeek = (date: string, firstWeekday = 1) =>
  addDays(date, -((isoWeekday(date) - firstWeekday + 7) % 7));

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export const startOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

export function addMonths(date: string, months: number): string {
  const [year, month] = date.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** The weeks shown for a month: whole weeks from the one holding the 1st to the one holding the last day. */
export function monthGrid(month: string, firstWeekday = 1): string[][] {
  const first = startOfMonth(month);
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (
    let week = startOfWeek(first, firstWeekday);
    week <= last;
    week = addDays(week, 7)
  ) {
    weeks.push(eachDay(week, addDays(week, 6)));
  }
  return weeks;
}

export const todayIn = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

/** `HH:MM` now in the school's time zone, to find the current period. */
export const timeIn = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

/** A calendar date as a Date at UTC midnight, for `Intl` formatting with `timeZone: "UTC"`. */
export const asUtcDate = (date: string) => new Date(toTime(date));
