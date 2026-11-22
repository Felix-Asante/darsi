import { occurrencesBetween, parseRecurrence } from './recurrence.js';

describe('parseRecurrence', () => {
  it('reads the supported subset', () => {
    expect(parseRecurrence('FREQ=WEEKLY;BYDAY=WE,MO;UNTIL=20270630')).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      byDay: [1, 3],
      until: '2027-06-30',
      count: null,
    });
    expect(parseRecurrence('RRULE:FREQ=YEARLY;COUNT=3')).toMatchObject({
      freq: 'YEARLY',
      count: 3,
    });
  });

  it.each([
    'FREQ=HOURLY',
    'FREQ=MONTHLY;BYDAY=MO',
    'FREQ=WEEKLY;BYSETPOS=1',
    'FREQ=DAILY;INTERVAL=0',
    'FREQ=DAILY;COUNT=2;UNTIL=20270101',
    'FREQ=WEEKLY;BYDAY=XX',
    'nonsense',
  ])('refuses %s', (rule) => {
    expect(parseRecurrence(rule)).toBeNull();
  });
});

describe('occurrencesBetween', () => {
  it('returns a one-off event when it overlaps the range', () => {
    expect(
      occurrencesBetween('2026-12-21', 13, null, '2027-01-01', '2027-01-31'),
    ).toEqual(['2026-12-21']);
    expect(
      occurrencesBetween('2026-12-21', 0, null, '2027-01-01', '2027-01-31'),
    ).toEqual([]);
  });

  it('repeats weekly on chosen days until a date', () => {
    const rule = parseRecurrence('FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261125')!;
    expect(
      occurrencesBetween('2026-11-11', 0, rule, '2026-11-01', '2026-11-30'),
    ).toEqual([
      '2026-11-11',
      '2026-11-16',
      '2026-11-18',
      '2026-11-23',
      '2026-11-25',
    ]);
  });

  it('repeats every other week and counts occurrences from the start', () => {
    const rule = parseRecurrence('FREQ=WEEKLY;INTERVAL=2;COUNT=3')!;
    expect(
      occurrencesBetween('2026-11-02', 0, rule, '2026-11-20', '2027-01-31'),
    ).toEqual(['2026-11-30']);
  });

  it('skips months without the day', () => {
    const rule = parseRecurrence('FREQ=MONTHLY;COUNT=4')!;
    expect(
      occurrencesBetween('2026-10-31', 0, rule, '2026-10-01', '2027-03-31'),
    ).toEqual(['2026-10-31', '2026-12-31', '2027-01-31', '2027-03-31']);
  });

  it('includes multi-day occurrences that started before the range', () => {
    const rule = parseRecurrence('FREQ=YEARLY')!;
    expect(
      occurrencesBetween('2025-12-20', 15, rule, '2027-01-01', '2027-01-10'),
    ).toEqual(['2026-12-20']);
  });
});
