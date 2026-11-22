import {
  NUMERIC_SCALE_KINDS,
  type ScaleDefinition,
} from "@/common/types/assessment";

/**
 * Display hints only. The API's grading engine (`api/src/modules/assessment/grading`)
 * is the source of truth and validates every grade; this mirrors its maths so
 * screens can show what a value would become before saving.
 */
const maxOf = (scale: ScaleDefinition) =>
  scale.kind === "percentage" ? 100 : (scale.maxPoints ?? 0);

export const isNumericScale = (scale: ScaleDefinition) =>
  NUMERIC_SCALE_KINDS.includes(scale.kind);

export function toMastery(
  scale: ScaleDefinition,
  value: string,
): number | null {
  if (isNumericScale(scale)) {
    const number = Number(value.trim().replace(",", "."));
    if (
      value.trim() === "" ||
      !Number.isFinite(number) ||
      number < 0 ||
      number > maxOf(scale)
    )
      return null;
    return number / maxOf(scale);
  }
  const levels = scale.levels ?? [];
  const index = levels.findIndex(
    (level) => level.code.toLowerCase() === value.trim().toLowerCase(),
  );
  if (index < 0) return null;
  return (levels[index].minMastery + (levels[index + 1]?.minMastery ?? 1)) / 2;
}

export function fromMastery(scale: ScaleDefinition, mastery: number): string {
  const clamped = Math.min(1, Math.max(0, mastery));
  if (isNumericScale(scale)) {
    const decimals = scale.decimals ?? (scale.kind === "percentage" ? 0 : 1);
    const factor = 10 ** decimals;
    return String(
      Math.round((clamped * maxOf(scale) + Number.EPSILON) * factor) / factor,
    );
  }
  const levels = scale.levels ?? [];
  return (
    (levels.findLast((level) => clamped >= level.minMastery) ?? levels[0])
      ?.code ?? ""
  );
}

/** Level codes, or the range for numbers, to tell people what they can type. */
export function allowedValues(scale: ScaleDefinition): string {
  return isNumericScale(scale)
    ? `0–${maxOf(scale)}`
    : (scale.levels ?? []).map((level) => level.code).join(", ");
}
