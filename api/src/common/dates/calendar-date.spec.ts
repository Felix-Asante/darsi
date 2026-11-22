import {
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  isoWeekday,
  startOfWeek,
  todayIn,
  zonedTimeToUtc,
} from './calendar-date.js';

describe('calendar dates', () => {
  it('adds days across months, years and daylight-saving changes', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-09-01', '2027-07-02')).toBe(304);
  });

  it('knows weekdays and week starts', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-22')).toBe(7);
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(eachDay('2026-11-16', '2026-11-18')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
  });

  it('skips months without the day', () => {
    expect(addMonths('2026-01-31', 1)).toBeNull();
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2024-02-29', 12)).toBeNull();
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('reads today in the school’s time zone', () => {
    const now = new Date('2026-11-19T23:30:00Z');
    expect(todayIn('Europe/Paris', now)).toBe('2026-11-20');
    expect(todayIn('America/New_York', now)).toBe('2026-11-19');
  });

  it('turns a school wall-clock time into an instant, across daylight saving', () => {
    expect(
      zonedTimeToUtc('2026-11-20T08:30', 'Europe/Paris').toISOString(),
    ).toBe('2026-11-20T07:30:00.000Z');
    expect(
      zonedTimeToUtc('2026-07-01T08:30', 'Europe/Paris').toISOString(),
    ).toBe('2026-07-01T06:30:00.000Z');
    expect(
      zonedTimeToUtc('2026-11-20T08:30', 'America/New_York').toISOString(),
    ).toBe('2026-11-20T13:30:00.000Z');
    expect(
      zonedTimeToUtc('2026-03-29T02:30', 'Europe/Paris').toISOString(),
    ).toBe('2026-03-29T01:30:00.000Z');
  });
});
