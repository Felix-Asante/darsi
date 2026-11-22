import type {
  AggregationMethod,
  ExplicitMapping,
  GradeValue,
  GradingScaleSnapshot,
  ScaleLevel,
  WeightedResult,
} from './types.js';
import { NUMERIC_KINDS } from './types.js';

export class GradeValueError extends Error {
  constructor(readonly code: 'notANumber' | 'outOfRange' | 'unknownLevel') {
    super(code);
  }
}

const isNumeric = (scale: GradingScaleSnapshot) =>
  NUMERIC_KINDS.includes(scale.kind);
const maxOf = (scale: GradingScaleSnapshot) =>
  scale.kind === 'percentage' ? 100 : (scale.maxPoints ?? 0);
const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/** Levels with the mastery range each covers: `[min, max)`, the top one closed at 1. */
function ranges(
  scale: GradingScaleSnapshot,
): (ScaleLevel & { maxMastery: number })[] {
  const levels = scale.levels ?? [];
  return levels.map((level, index) => ({
    ...level,
    maxMastery: levels[index + 1]?.minMastery ?? 1,
  }));
}

/** Problems with a scale definition, as stable codes. Empty when it can be used. */
export function validateScale(scale: GradingScaleSnapshot): string[] {
  if (isNumeric(scale)) {
    if (
      scale.kind === 'points' &&
      !(typeof scale.maxPoints === 'number' && scale.maxPoints > 0)
    )
      return ['maxPoints'];
    if (
      scale.decimals !== undefined &&
      !(
        Number.isInteger(scale.decimals) &&
        scale.decimals >= 0 &&
        scale.decimals <= 3
      )
    ) {
      return ['decimals'];
    }
    return [];
  }
  const levels = scale.levels ?? [];
  const errors: string[] = [];
  if (levels.length < 2) errors.push('tooFewLevels');
  if (scale.kind === 'pass_fail' && levels.length !== 2)
    errors.push('passFailLevels');
  if (levels[0] && levels[0].minMastery !== 0)
    errors.push('firstLevelStartsAtZero');
  if (
    levels.some(
      (level, index) =>
        index > 0 && level.minMastery <= levels[index - 1].minMastery,
    )
  ) {
    errors.push('levelsAscending');
  }
  if (levels.some((level) => level.minMastery < 0 || level.minMastery >= 1))
    errors.push('masteryRange');
  const codes = levels.map((level) => level.code.trim().toLowerCase());
  if (codes.some((code) => code === '') || new Set(codes).size !== codes.length)
    errors.push('uniqueCodes');
  return errors;
}

/** Reads a value entered on a scale, such as "15.5" on 0–20 or "b+" on letters. */
export function parseValue(
  scale: GradingScaleSnapshot,
  raw: GradeValue,
): GradeValue {
  if (isNumeric(scale)) {
    const value =
      typeof raw === 'number'
        ? raw
        : Number(String(raw).trim().replace(',', '.'));
    if (String(raw).trim() === '' || !Number.isFinite(value))
      throw new GradeValueError('notANumber');
    if (value < 0 || value > maxOf(scale))
      throw new GradeValueError('outOfRange');
    return value;
  }
  const code = String(raw).trim().toLowerCase();
  const level = (scale.levels ?? []).find(
    (candidate) => candidate.code.toLowerCase() === code,
  );
  if (!level) throw new GradeValueError('unknownLevel');
  return level.code;
}

/** Where a value sits between 0 (nothing shown) and 1 (full mastery). A level counts as the middle of its range. */
export function toMastery(
  scale: GradingScaleSnapshot,
  value: GradeValue,
): number {
  const parsed = parseValue(scale, value);
  if (typeof parsed === 'number') return parsed / maxOf(scale);
  const level = ranges(scale).find((candidate) => candidate.code === parsed)!;
  return (level.minMastery + level.maxMastery) / 2;
}

/** The value on `scale` for a mastery. Numbers are rounded to the scale's decimals. */
export function fromMastery(
  scale: GradingScaleSnapshot,
  mastery: number,
): GradeValue {
  const clamped = Math.min(1, Math.max(0, mastery));
  if (isNumeric(scale))
    return round(
      clamped * maxOf(scale),
      scale.decimals ?? (scale.kind === 'percentage' ? 0 : 1),
    );
  const levels = ranges(scale);
  return (levels.findLast((level) => clamped >= level.minMastery) ?? levels[0])
    .code;
}

/** A value from one scale on another: the school's own table first, then by mastery. */
export function convert(
  from: GradingScaleSnapshot,
  to: GradingScaleSnapshot,
  value: GradeValue,
  mapping?: ExplicitMapping,
): GradeValue {
  const parsed = parseValue(from, value);
  const mapped = mapping?.[String(parsed)];
  if (mapped !== undefined) return parseValue(to, mapped);
  return fromMastery(to, toMastery(from, parsed));
}

function combine(results: WeightedResult[], method: AggregationMethod): number {
  switch (method) {
    case 'weighted_average': {
      const total = results.reduce(
        (sum, result) => sum + (result.weight ?? 1),
        0,
      );
      if (total <= 0)
        return (
          results.reduce((sum, result) => sum + result.mastery, 0) /
          results.length
        );
      return (
        results.reduce(
          (sum, result) => sum + result.mastery * (result.weight ?? 1),
          0,
        ) / total
      );
    }
    case 'most_recent':
      return results.reduce((latest, result) =>
        (result.date ?? '') >= (latest.date ?? '') ? result : latest,
      ).mastery;
    case 'highest':
      return Math.max(...results.map((result) => result.mastery));
    case 'mode': {
      // The most frequent result; ties go to the higher one, so a student is never pulled down by a tie.
      const counts = new Map<number, number>();
      for (const result of results)
        counts.set(result.mastery, (counts.get(result.mastery) ?? 0) + 1);
      return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    }
  }
}

/**
 * A term result in mastery: each category is combined with `method`, then the
 * categories are averaged by their weights (only those with results count, so
 * an empty category does not drag the result down). Null with no results.
 */
export function aggregate(
  results: WeightedResult[],
  method: AggregationMethod,
  categoryWeights: Record<string, number> = {},
): number | null {
  if (results.length === 0) return null;
  const buckets = new Map<string, WeightedResult[]>();
  for (const result of results) {
    const key = result.category ?? '';
    buckets.set(key, [...(buckets.get(key) ?? []), result]);
  }
  if (buckets.size === 1 || Object.keys(categoryWeights).length === 0) {
    return combine(results, method);
  }
  let weighted = 0;
  let total = 0;
  for (const [category, bucket] of buckets) {
    const weight = categoryWeights[category] ?? 0;
    weighted += combine(bucket, method) * weight;
    total += weight;
  }
  return total > 0 ? weighted / total : combine(results, method);
}
