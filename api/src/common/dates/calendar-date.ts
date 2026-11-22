/**
 * Calendar dates (`2026-09-01`) have no time zone: a holiday is the same day
 * everywhere. They are computed in UTC so no offset can shift the day.
 */
const DAY_MS = 86_400_000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

export const addDays = (date: string, days: number) =>
  fromTime(toTime(date) + days * DAY_MS);

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string) =>
  Math.round((toTime(to) - toTime(from)) / DAY_MS);

/** ISO weekday: 1 is Monday, 7 is Sunday. */
export const isoWeekday = (date: string) =>
  ((new Date(toTime(date)).getUTCDay() + 6) % 7) + 1;

/** The Monday of the date's week. */
export const startOfWeek = (date: string) =>
  addDays(date, 1 - isoWeekday(date));

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function addMonths(date: string, months: number): string | null {
  const [year, month, day] = date.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const target = new Date(Date.UTC(Math.floor(total / 12), total % 12, day));
  // Months without this day (the 31st, 29 February) have no occurrence.
  return target.getUTCDate() === day ? fromTime(target.getTime()) : null;
}

export const todayIn = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

/**
 * The instant a wall-clock time (`2026-11-20T08:30`) happens in a time zone.
 * Daylight-saving gaps resolve forward, as clocks do.
 */
export function zonedTimeToUtc(local: string, timeZone: string): Date {
  const guess = Date.parse(`${local}:00Z`);
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    const asUtc = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second,
    );
    return asUtc - instant;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}
