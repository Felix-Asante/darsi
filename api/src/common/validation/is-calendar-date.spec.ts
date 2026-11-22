import { isCalendarDate } from './is-calendar-date.js';

describe('isCalendarDate', () => {
  it.each(['2027-02-28', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    '2027-02-29',
    '2027-13-01',
    '2027-2-3',
    '2027-02-28T00:00:00Z',
    20270228,
    null,
  ])('rejects %s', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});
