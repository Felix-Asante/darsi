export const SCALE_KINDS = [
  'points',
  'percentage',
  'letter',
  'levels',
  'standards',
  'pass_fail',
  'custom',
] as const;
export type ScaleKind = (typeof SCALE_KINDS)[number];

/** Numeric scales take a number; every other kind takes a level code. */
export const NUMERIC_KINDS: ScaleKind[] = ['points', 'percentage'];

/**
 * One level of a scale, such as `A+`, `7` or `PASS`. Levels cover the 0–1
 * mastery range without gaps: a level holds `minMastery` up to the next
 * level's `minMastery`, and the top level up to 1 included.
 */
export interface ScaleLevel {
  code: string;
  label?: string;
  minMastery: number;
}

/** A scale exactly as it was at one version. Grades keep the version they were entered with. */
export interface GradingScaleSnapshot {
  kind: ScaleKind;
  /** Points scales: the maximum, such as 20 for French marks. */
  maxPoints?: number;
  /** Numeric scales: decimals kept when converting into this scale. */
  decimals?: number;
  /** Level scales, ordered from lowest to highest mastery. */
  levels?: ScaleLevel[];
}

export type GradeValue = number | string;

/** A school's own conversion table, `from` code → `to` code. It wins over the mastery-based default. */
export type ExplicitMapping = Record<string, string>;

export const AGGREGATION_METHODS = [
  'weighted_average',
  'most_recent',
  'highest',
  'mode',
] as const;
export type AggregationMethod = (typeof AGGREGATION_METHODS)[number];

export interface WeightedResult {
  mastery: number;
  /** Relative weight inside its category. Defaults to 1. */
  weight?: number;
  /** Category for weighted categories; results without one share a single bucket. */
  category?: string | null;
  /** ISO date, used by "most recent". */
  date?: string | null;
}
