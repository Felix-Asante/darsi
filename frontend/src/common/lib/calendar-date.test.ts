import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  isoWeekday,
  monthGrid,
  startOfWeek,
  timeIn,
  todayIn,
} from "./calendar-date";

describe("calendar dates", () => {
  it("does date arithmetic without time zones", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(isoWeekday("2026-11-22")).toBe(7);
    expect(startOfWeek("2026-11-22")).toBe("2026-11-16");
    expect(startOfWeek("2026-11-19", 7)).toBe("2026-11-15");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("lays out a month in whole weeks", () => {
    const weeks = monthGrid("2026-11-19");
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks.at(-1)?.at(-1)).toBe("2026-12-06");
    expect(weeks).toHaveLength(6);
  });

  it("reads today and the time in the school's time zone", () => {
    const now = new Date("2026-11-19T23:30:00Z");
    expect(todayIn("Europe/Paris", now)).toBe("2026-11-20");
    expect(timeIn("Europe/Paris", now)).toBe("00:30");
  });
});
