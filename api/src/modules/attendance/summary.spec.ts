import { summarize, toCsv } from './summary.js';

describe('summarize', () => {
  it('counts attended sessions out of those the student was expected at', () => {
    expect(
      summarize(['present', 'present', 'late', 'absent', 'excused']),
    ).toEqual({
      sessions: 5,
      present: 2,
      absent: 1,
      late: 1,
      excused: 1,
      rate: 0.75,
    });
    expect(summarize([]).rate).toBeNull();
    expect(summarize(['excused']).rate).toBeNull();
  });
});

describe('toCsv', () => {
  it('quotes where needed and defuses spreadsheet formulas', () => {
    expect(
      toCsv([
        ['Name', 'Rate'],
        ['Haddad, Amira', 0.75],
        ['=1+1', null],
        ['Say "hi"', 1],
      ]),
    ).toBe(
      'Name,Rate\r\n"Haddad, Amira",0.75\r\n\'=1+1,\r\n"Say ""hi""",1\r\n',
    );
  });
});
