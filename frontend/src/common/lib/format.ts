type MinorUnits = bigint | number | string;

function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/** `4825000` minor units of EUR → "48250.00", exact for any amount. */
function toDecimalString(minorUnits: MinorUnits, digits: number): string {
  const value = BigInt(minorUnits);
  const negative = value < BigInt(0);
  const sign = negative ? "-" : "";
  const digitsOnly = (negative ? -value : value)
    .toString()
    .padStart(digits + 1, "0");
  if (digits === 0) return `${sign}${digitsOnly}`;
  return `${sign}${digitsOnly.slice(0, -digits)}.${digitsOnly.slice(-digits)}`;
}

/** Amounts are stored as integer minor units, so they are formatted from an exact decimal string. */
export function formatMoney(
  minorUnits: MinorUnits,
  currency: string,
  locale: string,
): string {
  const decimal = toDecimalString(minorUnits, currencyDigits(currency));
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    decimal as Intl.StringNumericLiteral,
  );
}

export type DateStyle = "short" | "medium" | "long";

/** Dates are shown in the school's time zone, whatever the viewer's device says. */
export function formatDate(
  date: Date | string,
  locale: string,
  timeZone: string,
  dateStyle: DateStyle = "medium",
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle, timeZone }).format(
    new Date(date),
  );
}

export function formatDateTime(
  date: Date | string,
  locale: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);
}

/** Calendar dates (`2013-05-01`) have no time zone, so they are shown exactly as stored. */
export function formatCalendarDate(
  isoDate: string,
  locale: string,
  dateStyle: DateStyle = "medium",
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle, timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/** `1536` → "1.5 kB" / "1,5 ko", in the user's language. */
export function formatBytes(bytes: number, locale: string): string {
  const units = [
    "byte",
    "kilobyte",
    "megabyte",
    "gigabyte",
    "terabyte",
  ] as const;
  const exponent = Math.min(
    units.length - 1,
    Math.max(0, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024))),
  );
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[exponent],
    unitDisplay: "short",
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  }).format(bytes / 1024 ** exponent);
}
