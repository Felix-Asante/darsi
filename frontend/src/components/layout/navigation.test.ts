import { describe, expect, it } from "vitest";
import { isActivePath, navigationFor } from "./navigation";

const labels = (roles: Parameters<typeof navigationFor>[0]) =>
  navigationFor(roles).flatMap((section) =>
    section.items.map((item) => item.label),
  );

describe("navigationFor", () => {
  it("never shows fees or admissions to academic staff", () => {
    expect(labels(["teacher"])).not.toContain("billing");
    expect(labels(["teaching_assistant"])).not.toContain("admissions");
  });

  it("shows guardians their family's billing but no staff tools", () => {
    expect(labels(["guardian"])).toEqual([
      "today",
      "timetable",
      "calendar",
      "announcements",
      "grades",
      "portfolio",
      "reEnrolment",
      "billing",
    ]);
  });

  it("shows applicant families only their applications and fees", () => {
    expect(labels(["applicant"])).toEqual(["applications", "billing"]);
  });

  it("combines the roles of a user who holds several", () => {
    const teacherAndParent = labels(["teacher", "guardian"]);

    expect(teacherAndParent).toContain("gradebook");
    expect(teacherAndParent).toContain("billing");
  });

  it("drops sections with nothing visible", () => {
    expect(navigationFor(["student"]).map((section) => section.label)).toEqual([
      undefined,
      "teaching",
    ]);
  });

  it("shows nothing to someone with no role", () => {
    expect(navigationFor([])).toEqual([]);
  });
});

describe("isActivePath", () => {
  it("matches a section and its sub-pages only", () => {
    expect(isActivePath("/classes/abc/gradebook", "/classes")).toBe(true);
    expect(isActivePath("/classes-archive", "/classes")).toBe(false);
    expect(isActivePath("/calendar", "/")).toBe(false);
    expect(isActivePath("/", "/")).toBe(true);
  });
});
