import type { GradingScaleSnapshot } from './types.js';

const evenLevels = (codes: string[]) =>
  codes.map((code, index) => ({
    code,
    minMastery: Math.round((index / codes.length) * 10_000) / 10_000,
  }));

/**
 * Common grading schemes, offered as starting points so a school can set up
 * its scales without help. Boundaries are editable once copied.
 */
export const SCALE_PRESETS = {
  ib_myp: {
    name: 'IB MYP criterion (0–8)',
    scale: {
      kind: 'levels',
      levels: evenLevels(['0', '1', '2', '3', '4', '5', '6', '7', '8']),
    },
  },
  ib_dp: {
    name: 'IB Diploma (1–7)',
    scale: {
      kind: 'levels',
      levels: evenLevels(['1', '2', '3', '4', '5', '6', '7']),
    },
  },
  us_letters: {
    name: 'US letter grades (A+ to F)',
    scale: {
      kind: 'letter',
      levels: [
        { code: 'F', minMastery: 0 },
        { code: 'D-', minMastery: 0.6 },
        { code: 'D', minMastery: 0.63 },
        { code: 'D+', minMastery: 0.67 },
        { code: 'C-', minMastery: 0.7 },
        { code: 'C', minMastery: 0.73 },
        { code: 'C+', minMastery: 0.77 },
        { code: 'B-', minMastery: 0.8 },
        { code: 'B', minMastery: 0.83 },
        { code: 'B+', minMastery: 0.87 },
        { code: 'A-', minMastery: 0.9 },
        { code: 'A', minMastery: 0.93 },
        { code: 'A+', minMastery: 0.97 },
      ],
    },
  },
  french_20: {
    name: 'Note sur 20',
    scale: { kind: 'points', maxPoints: 20, decimals: 1 },
  },
  uk_gcse: {
    name: 'UK GCSE (9–1)',
    scale: {
      kind: 'levels',
      levels: evenLevels(['U', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
    },
  },
  standards_4: {
    name: 'Standards-based (1–4)',
    scale: {
      kind: 'standards',
      levels: [
        { code: '1', label: 'Beginning', minMastery: 0 },
        { code: '2', label: 'Developing', minMastery: 0.4 },
        { code: '3', label: 'Proficient', minMastery: 0.65 },
        { code: '4', label: 'Exceeding', minMastery: 0.85 },
      ],
    },
  },
  pass_fail: {
    name: 'Pass / fail',
    scale: {
      kind: 'pass_fail',
      levels: [
        { code: 'FAIL', label: 'Fail', minMastery: 0 },
        { code: 'PASS', label: 'Pass', minMastery: 0.5 },
      ],
    },
  },
  percentage: {
    name: 'Percentage',
    scale: { kind: 'percentage', decimals: 0 },
  },
  cambridge: {
    name: 'Cambridge IGCSE (A*–U)',
    scale: {
      kind: 'letter',
      levels: [
        { code: 'U', minMastery: 0 },
        { code: 'G', minMastery: 0.2 },
        { code: 'F', minMastery: 0.3 },
        { code: 'E', minMastery: 0.4 },
        { code: 'D', minMastery: 0.5 },
        { code: 'C', minMastery: 0.6 },
        { code: 'B', minMastery: 0.7 },
        { code: 'A', minMastery: 0.8 },
        { code: 'A*', minMastery: 0.9 },
      ],
    },
  },
  german_6: {
    name: 'Noten 1–6 (1 is best)',
    scale: {
      kind: 'levels',
      levels: [
        { code: '6', minMastery: 0 },
        { code: '5', minMastery: 0.3 },
        { code: '4', minMastery: 0.5 },
        { code: '3', minMastery: 0.67 },
        { code: '2', minMastery: 0.81 },
        { code: '1', minMastery: 0.92 },
      ],
    },
  },
  australian_ae: {
    name: 'Australian A–E',
    scale: {
      kind: 'letter',
      levels: [
        { code: 'E', minMastery: 0 },
        { code: 'D', minMastery: 0.4 },
        { code: 'C', minMastery: 0.55 },
        { code: 'B', minMastery: 0.7 },
        { code: 'A', minMastery: 0.85 },
      ],
    },
  },
  descriptors: {
    name: 'Emerging to mastered',
    scale: {
      kind: 'custom',
      levels: [
        { code: 'EM', label: 'Emerging', minMastery: 0 },
        { code: 'DV', label: 'Developing', minMastery: 0.35 },
        { code: 'SE', label: 'Secure', minMastery: 0.6 },
        { code: 'MA', label: 'Mastered', minMastery: 0.85 },
      ],
    },
  },
} satisfies Record<string, { name: string; scale: GradingScaleSnapshot }>;

export type ScalePresetKey = keyof typeof SCALE_PRESETS;
