import { cycleDays, cycleLength } from './rotation.js';

const MON_FRI = [1, 2, 3, 4, 5];
const noHolidays = () => false;

describe('cycleDays', () => {
  it('numbers a one-week timetable by weekday and skips weekends', () => {
    const days = cycleDays(
      '2026-11-13',
      '2026-11-16',
      { kind: 'weekly', weeks: 1 },
      {
        anchor: '2026-09-01',
        weekdays: MON_FRI,
        isDayOff: noHolidays,
      },
    );
    expect([...days]).toEqual([
      ['2026-11-13', 5],
      ['2026-11-14', null],
      ['2026-11-15', null],
      ['2026-11-16', 1],
    ]);
  });

  it('alternates Week A and Week B from the week the year starts, through holidays', () => {
    const holiday = (date: string) =>
      date >= '2026-10-19' && date <= '2026-11-01';
    const calendar = {
      anchor: '2026-09-02',
      weekdays: MON_FRI,
      isDayOff: holiday,
    };
    const rotation = { kind: 'weekly', weeks: 2 } as const;

    expect(
      cycleDays('2026-09-01', '2026-09-01', rotation, calendar).get(
        '2026-09-01',
      ),
    ).toBeNull();
    expect(
      cycleDays('2026-09-02', '2026-09-02', rotation, calendar).get(
        '2026-09-02',
      ),
    ).toBe(3);
    expect(
      cycleDays('2026-09-07', '2026-09-07', rotation, calendar).get(
        '2026-09-07',
      ),
    ).toBe(6);
    expect(
      cycleDays('2026-10-19', '2026-10-19', rotation, calendar).get(
        '2026-10-19',
      ),
    ).toBeNull();
    // 2 Nov is nine weeks after the first week: Week B, even after two weeks of holiday.
    expect(
      cycleDays('2026-11-02', '2026-11-02', rotation, calendar).get(
        '2026-11-02',
      ),
    ).toBe(6);
    expect(
      cycleDays('2026-11-09', '2026-11-09', rotation, calendar).get(
        '2026-11-09',
      ),
    ).toBe(1);
    expect(cycleLength(rotation, MON_FRI)).toBe(10);
  });

  it('advances a day 1–6 cycle only on school days', () => {
    const calendar = {
      anchor: '2026-11-02',
      weekdays: MON_FRI,
      isDayOff: (date: string) => date === '2026-11-11',
    };
    const days = cycleDays(
      '2026-11-09',
      '2026-11-13',
      { kind: 'cycle', days: 6 },
      calendar,
    );
    // 2–6 Nov are days 1–5; 9 Nov is day 6; the holiday on 11 Nov keeps day 2 for the 12th.
    expect([...days.values()]).toEqual([6, 1, null, 2, 3]);
  });

  it('starts the week on the first school day, for Sunday to Thursday schools', () => {
    const weekB = cycleDays(
      '2026-09-13',
      '2026-09-13',
      { kind: 'weekly', weeks: 2 },
      {
        anchor: '2026-09-06',
        weekdays: [7, 1, 2, 3, 4],
        isDayOff: noHolidays,
      },
    );
    expect(weekB.get('2026-09-13')).toBe(6);
  });

  it('supports Sunday to Thursday school weeks', () => {
    const days = cycleDays(
      '2026-11-15',
      '2026-11-21',
      { kind: 'weekly', weeks: 1 },
      {
        anchor: '2026-09-01',
        weekdays: [7, 1, 2, 3, 4],
        isDayOff: noHolidays,
      },
    );
    expect(days.get('2026-11-15')).toBe(1);
    expect(days.get('2026-11-16')).toBe(2);
    expect(days.get('2026-11-20')).toBeNull();
  });
});
