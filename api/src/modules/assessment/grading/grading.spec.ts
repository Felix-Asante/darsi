import fc from 'fast-check';
import {
  aggregate,
  convert,
  fromMastery,
  GradeValueError,
  parseValue,
  toMastery,
  validateScale,
} from './grading.js';
import { SCALE_PRESETS } from './presets.js';
import type { GradingScaleSnapshot } from './types.js';

const presets = Object.entries(SCALE_PRESETS) as [
  string,
  { name: string; scale: GradingScaleSnapshot },
][];
const scale = (key: keyof typeof SCALE_PRESETS) =>
  SCALE_PRESETS[key].scale as GradingScaleSnapshot;
const levelScales = presets.filter(([, preset]) => preset.scale.levels);
const codesOf = (target: GradingScaleSnapshot) =>
  target.levels!.map((level) => level.code);

describe('presets', () => {
  it.each(presets)('%s is a valid scale', (_, preset) => {
    expect(validateScale(preset.scale)).toEqual([]);
  });

  it('covers at least ten real-world schemes', () => {
    expect(presets.length).toBeGreaterThanOrEqual(10);
  });
});

describe('validateScale', () => {
  it('rejects gaps, disorder, duplicates and missing maxima', () => {
    expect(
      validateScale({
        kind: 'letter',
        levels: [
          { code: 'A', minMastery: 0.1 },
          { code: 'B', minMastery: 0.5 },
        ],
      }),
    ).toEqual(['firstLevelStartsAtZero']);
    expect(
      validateScale({
        kind: 'letter',
        levels: [
          { code: 'A', minMastery: 0 },
          { code: 'a', minMastery: 0 },
        ],
      }),
    ).toEqual(['levelsAscending', 'uniqueCodes']);
    expect(validateScale({ kind: 'points' })).toEqual(['maxPoints']);
    expect(
      validateScale({
        kind: 'pass_fail',
        levels: [{ code: 'X', minMastery: 0 }],
      }),
    ).toContain('passFailLevels');
  });
});

describe('reading values', () => {
  it('accepts French decimal commas and any letter case', () => {
    expect(parseValue(scale('french_20'), '15,5')).toBe(15.5);
    expect(parseValue(scale('us_letters'), 'b+')).toBe('B+');
  });

  it.each([
    ['french_20', '21', 'outOfRange'],
    ['french_20', 'abc', 'notANumber'],
    ['french_20', '', 'notANumber'],
    ['ib_dp', '8', 'unknownLevel'],
  ] as const)('refuses %s value %s', (key, value, code) => {
    expect(() => parseValue(scale(key), value)).toThrow(
      new GradeValueError(code),
    );
  });
});

describe('conversion', () => {
  it('converts between real schemes through mastery', () => {
    expect(toMastery(scale('french_20'), 15)).toBe(0.75);
    expect(convert(scale('french_20'), scale('percentage'), 15)).toBe(75);
    expect(convert(scale('ib_dp'), scale('us_letters'), '7')).toBe('A-');
    expect(convert(scale('ib_dp'), scale('french_20'), '4')).toBe(10);
    expect(convert(scale('standards_4'), scale('pass_fail'), '1')).toBe('FAIL');
    expect(convert(scale('standards_4'), scale('pass_fail'), '3')).toBe('PASS');
    expect(convert(scale('uk_gcse'), scale('cambridge'), '9')).toBe('A*');
    expect(convert(scale('german_6'), scale('australian_ae'), '1')).toBe('A');
  });

  it('lets a school’s own table win over the default', () => {
    const official = { '15': 'A', '16': 'A+' };
    expect(convert(scale('french_20'), scale('us_letters'), 15)).toBe('C');
    expect(convert(scale('french_20'), scale('us_letters'), 15, official)).toBe(
      'A',
    );
    expect(convert(scale('french_20'), scale('us_letters'), 14, official)).toBe(
      'C-',
    );
  });

  it.each(levelScales)('%s round-trips every level', (_, preset) => {
    for (const code of codesOf(preset.scale)) {
      expect(fromMastery(preset.scale, toMastery(preset.scale, code))).toBe(
        code,
      );
    }
  });

  it('is monotonic: a higher mark never converts to a lower level', () => {
    const french = scale('french_20');
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        fc.constantFrom(...levelScales),
        (a, b, [, target]) => {
          const [low, high] = [Math.min(a, b) / 10, Math.max(a, b) / 10];
          const codes = codesOf(target.scale);
          expect(
            codes.indexOf(String(convert(french, target.scale, low))),
          ).toBeLessThanOrEqual(
            codes.indexOf(String(convert(french, target.scale, high))),
          );
        },
      ),
    );
  });

  it('keeps any mastery inside the target scale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.constantFrom(...presets),
        (mastery, [, target]) => {
          expect(() =>
            parseValue(target.scale, fromMastery(target.scale, mastery)),
          ).not.toThrow();
        },
      ),
    );
  });
});

describe('aggregate', () => {
  it('weights categories, ignoring the ones without results', () => {
    const results = [
      { mastery: 0.5, category: 'homework' },
      { mastery: 0.7, category: 'homework' },
      { mastery: 0.9, category: 'exams', weight: 2 },
      { mastery: 0.6, category: 'exams' },
    ];
    // Homework 0.6, exams (0.9×2 + 0.6)/3 = 0.8; weighted 30/70 → 0.74.
    expect(
      aggregate(results, 'weighted_average', {
        homework: 30,
        exams: 70,
        projects: 50,
      }),
    ).toBeCloseTo(0.74);
  });

  it('supports most recent, highest and mode', () => {
    const results = [
      { mastery: 0.4, date: '2026-10-01' },
      { mastery: 0.8, date: '2026-11-01' },
      { mastery: 0.6, date: '2026-12-01' },
      { mastery: 0.4, date: '2026-12-02' },
      { mastery: 0.8, date: '2026-09-01' },
    ];
    expect(aggregate(results, 'most_recent')).toBe(0.4);
    expect(aggregate(results, 'highest')).toBe(0.8);
    expect(aggregate(results, 'mode')).toBe(0.8);
    expect(aggregate([], 'weighted_average')).toBeNull();
  });

  it('stays between the lowest and highest result', () => {
    const result = fc.record({
      mastery: fc.double({ min: 0, max: 1, noNaN: true }),
      weight: fc.integer({ min: 0, max: 10 }),
      category: fc.constantFrom('a', 'b', null),
    });
    fc.assert(
      fc.property(
        fc.array(result, { minLength: 1, maxLength: 30 }),
        fc.constantFrom(
          'weighted_average',
          'most_recent',
          'highest',
          'mode' as const,
        ),
        (results, method) => {
          const value = aggregate(results, method, { a: 2, b: 1 })!;
          const masteries = results.map((entry) => entry.mastery);
          expect(value).toBeGreaterThanOrEqual(Math.min(...masteries) - 1e-9);
          expect(value).toBeLessThanOrEqual(Math.max(...masteries) + 1e-9);
        },
      ),
    );
  });
});
