function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/**
 * What a person types ("4 500,50", "4,500.50", "4500") → minor units ("450050"),
 * without floating point. The last "." or "," is the decimal separator when it
 * is followed by no more than the currency's digits. Returns null if unreadable.
 */
export function parseMoneyInput(text: string, currency: string): string | null {
  const digits = currencyDigits(currency);
  const cleaned = text.replace(/[\s  ']/g, "");
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;
  const separator = Math.max(
    cleaned.lastIndexOf("."),
    cleaned.lastIndexOf(","),
  );
  let whole = cleaned;
  let fraction = "";
  if (
    separator >= 0 &&
    cleaned.length - separator - 1 <= digits &&
    cleaned.length - separator - 1 > 0
  ) {
    whole = cleaned.slice(0, separator);
    fraction = cleaned.slice(separator + 1);
  }
  // Anything left must be thousands groups of three digits.
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(whole)) return null;
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d+$/.test(whole) || (digits === 0 && fraction)) return null;
  const minor =
    BigInt(whole) * BigInt(10) ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  if (minor.toString().length > 15) return null;
  return minor.toString();
}

/** Minor units → a plain editable value ("450050" → "4500.50"). */
export function minorToInput(minor: string, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === 0) return minor;
  const padded = minor.padStart(digits + 1, "0");
  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
}

/** Basis points ↔ a percentage as typed ("5.5" ↔ 550). */
export function parsePercentInput(text: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const value =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return value <= 10_000 ? value : null;
}

export function basisPointsToInput(bp: number): string {
  return (bp / 100).toString();
}
