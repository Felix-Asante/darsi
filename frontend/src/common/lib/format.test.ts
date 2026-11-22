import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCalendarDate,
  formatDate,
  formatMoney,
  formatPercent,
} from "./format";

const normalizeSpaces = (value: string) => value.replace(/[  ]/g, " ");

describe("formatMoney", () => {
  it("formats minor units in the locale's convention", () => {
    expect(formatMoney(4_825_000, "EUR", "en")).toBe("€48,250.00");
    expect(normalizeSpaces(formatMoney(4_825_000, "EUR", "fr"))).toBe(
      "48 250,00 €",
    );
  });

  it("respects each currency's minor unit", () => {
    expect(formatMoney(1500, "JPY", "en")).toBe("¥1,500");
    expect(normalizeSpaces(formatMoney(12_345, "KWD", "en"))).toBe(
      "KWD 12.345",
    );
  });

  it("stays exact beyond floating-point precision", () => {
    expect(formatMoney(BigInt("900719925474099301"), "USD", "en")).toBe(
      "$9,007,199,254,740,993.01",
    );
  });

  it("formats negative amounts such as credit notes", () => {
    expect(formatMoney(-2550, "USD", "en")).toBe("-$25.50");
  });
});

describe("formatDate", () => {
  it("shows the date in the school's time zone, not the viewer's", () => {
    const lateEveningInNewYork = "2027-03-01T03:30:00Z";

    expect(formatDate(lateEveningInNewYork, "en", "America/New_York")).toBe(
      "Feb 28, 2027",
    );
    expect(formatDate(lateEveningInNewYork, "fr", "Europe/Paris")).toBe(
      "1 mars 2027",
    );
  });
});

describe("formatPercent", () => {
  it("formats attendance rates", () => {
    expect(formatPercent(0.9437, "en")).toBe("94.4%");
    expect(normalizeSpaces(formatPercent(0.9437, "fr"))).toBe("94,4 %");
  });
});

describe("formatCalendarDate", () => {
  it("shows the stored day whatever the time zone", () => {
    expect(formatCalendarDate("2013-05-01", "en-US")).toBe("May 1, 2013");
    expect(formatCalendarDate("2013-05-01", "fr", "short")).toBe("01/05/2013");
  });
});

describe("formatBytes", () => {
  it("uses the reader's language and sensible units", () => {
    expect(formatBytes(1536, "en")).toBe("1.5 kB");
    expect(normalizeSpaces(formatBytes(5 * 1024 ** 3, "fr"))).toBe("5 Go");
    expect(formatBytes(12, "en")).toBe("12 byte");
  });
});
