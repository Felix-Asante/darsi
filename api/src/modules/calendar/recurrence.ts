import {
  addDays,
  addMonths,
  daysBetween,
  isoWeekday,
  startOfWeek,
} from '../../common/dates/calendar-date.js';

/**
 * The part of RFC 5545 RRULE that school calendars need: FREQ, INTERVAL,
 * BYDAY (weekly only), UNTIL and COUNT. Anything else is refused, so a rule is
 * never silently read differently from how the user wrote it.
 */
export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  byDay: number[] | null;
  until: string | null;
  count: number | null;
}

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const MAX_OCCURRENCES = 1000;

export function parseRecurrence(text: string): RecurrenceRule | null {
  const parts = new Map<string, string>();
  for (const part of text.replace(/^RRULE:/i, '').split(';')) {
    const [key, value] = part.split('=');
    if (!key || !value || parts.has(key.toUpperCase())) return null;
    parts.set(key.toUpperCase(), value.toUpperCase());
  }

  const freq = parts.get('FREQ');
  if (
    freq !== 'DAILY' &&
    freq !== 'WEEKLY' &&
    freq !== 'MONTHLY' &&
    freq !== 'YEARLY'
  )
    return null;
  if (
    [...parts.keys()].some(
      (key) => !['FREQ', 'INTERVAL', 'BYDAY', 'UNTIL', 'COUNT'].includes(key),
    )
  )
    return null;

  const interval = Number(parts.get('INTERVAL') ?? '1');
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) return null;

  let byDay: number[] | null = null;
  if (parts.has('BYDAY')) {
    if (freq !== 'WEEKLY') return null;
    byDay = parts
      .get('BYDAY')!
      .split(',')
      .map((day) => WEEKDAYS.indexOf(day) + 1);
    if (byDay.some((day) => day === 0)) return null;
    byDay = [...new Set(byDay)].sort((a, b) => a - b);
  }

  let until: string | null = null;
  if (parts.has('UNTIL')) {
    const match = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(
      parts.get('UNTIL')!,
    );
    if (!match) return null;
    until = `${match[1]}-${match[2]}-${match[3]}`;
  }

  const count = parts.has('COUNT') ? Number(parts.get('COUNT')) : null;
  if (
    count !== null &&
    (!Number.isInteger(count) || count < 1 || count > MAX_OCCURRENCES)
  )
    return null;
  if (until && count) return null;

  return { freq, interval, byDay, until, count };
}

/** Start dates in order, from `start`, without end. Callers stop iterating. */
function* starts(start: string, rule: RecurrenceRule): Generator<string> {
  if (rule.freq === 'WEEKLY') {
    const days = rule.byDay ?? [isoWeekday(start)];
    for (
      let week = startOfWeek(start);
      ;
      week = addDays(week, 7 * rule.interval)
    ) {
      for (const day of days) {
        const date = addDays(week, day - 1);
        if (date >= start) yield date;
      }
    }
  }
  for (let step = 0; ; step += 1) {
    if (rule.freq === 'DAILY') yield addDays(start, step * rule.interval);
    else {
      const date = addMonths(
        start,
        step * rule.interval * (rule.freq === 'YEARLY' ? 12 : 1),
      );
      if (date) yield date;
    }
  }
}

/**
 * Start dates of the occurrences that overlap `from`–`to` (inclusive), for an
 * event lasting `lengthDays` (0 for a single day).
 */
export function occurrencesBetween(
  start: string,
  lengthDays: number,
  rule: RecurrenceRule | null,
  from: string,
  to: string,
): string[] {
  if (!rule)
    return start <= to && addDays(start, lengthDays) >= from ? [start] : [];

  const result: string[] = [];
  let index = 0;
  for (const date of starts(start, rule)) {
    index += 1;
    if (
      date > to ||
      (rule.until && date > rule.until) ||
      (rule.count && index > rule.count) ||
      index > MAX_OCCURRENCES * 10
    )
      break;
    if (addDays(date, lengthDays) >= from) result.push(date);
  }
  return result;
}

export const lengthInDays = (startsOn: string, endsOn: string) =>
  daysBetween(startsOn, endsOn);
