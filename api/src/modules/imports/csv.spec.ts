import { parseCsv, splitList } from './csv.js';

describe('parseCsv', () => {
  it('reads a header row, trimming cells and normalising column names', () => {
    const { headers, rows } = parseCsv(
      '﻿Student Number,First-Name\n S-1 , Amira \n\nS-2,Lucas\n',
    );

    expect(headers).toEqual(['student_number', 'first_name']);
    expect(rows).toEqual([
      { student_number: 'S-1', first_name: 'Amira' },
      { student_number: 'S-2', first_name: 'Lucas' },
    ]);
  });

  it('accepts semicolon-separated files, as spreadsheets export in French', () => {
    expect(parseCsv('code;name\nMATH;Mathématiques').rows).toEqual([
      { code: 'MATH', name: 'Mathématiques' },
    ]);
  });

  it('keeps semicolon lists inside a comma-separated file', () => {
    expect(
      parseCsv('email,student_numbers\nleila@x.test,A1;A2').rows[0]
        .student_numbers,
    ).toBe('A1;A2');
  });

  it('keeps quoted commas inside a cell', () => {
    expect(
      parseCsv('name,description\nA,"Reads, writes"').rows[0].description,
    ).toBe('Reads, writes');
  });
});

describe('splitList', () => {
  it('splits on semicolons and pipes', () => {
    expect(splitList('a@x.test; b@x.test | c@x.test')).toEqual([
      'a@x.test',
      'b@x.test',
      'c@x.test',
    ]);
    expect(splitList('')).toEqual([]);
  });
});
