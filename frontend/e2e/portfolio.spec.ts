import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

const NOW = new Date("2026-11-19T08:40:00Z");
const student = { id: "s1", studentNumber: "S-1", firstName: "Amira", lastName: "Haddad", preferredName: null, status: "active", gradeLevel: { id: "g", name: "Grade 7" } };
const item = {
  id: "i1",
  studentId: "s1",
  classId: null,
  kind: "text",
  title: "My poem",
  description: null,
  url: null,
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Roses are red" }] }] },
  file: null,
  tags: ["poetry"],
  status: "approved",
  addedBy: { id: "u", name: "Amira Haddad" },
  createdAt: "2026-11-10T10:00:00Z",
  comments: [{ id: "c1", kind: "comment", body: "Lovely imagery.", author: { id: "t", name: "Ada Lovelace" }, createdAt: "2026-11-11T10:00:00Z" }],
  canApprove: false,
  canDelete: false,
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("shows a family the whole portfolio on one page, without fees", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "/api/v1/portfolio/students/s1": (route) =>
      json(route, {
        student,
        term: { id: "t1", name: "Term 1", startsOn: "2026-09-01", endsOn: "2026-12-18" },
        week: {
          from: "2026-11-16",
          to: "2026-11-22",
          lessons: [
            {
              date: "2026-11-16",
              cycleDay: 1,
              slotId: "x",
              room: null,
              period: { id: "p", name: "P1", startsAt: "08:30", endsAt: "09:25", sortOrder: 0 },
              class: { id: "c1", code: "M7A", name: "Maths 7A", subject: null },
              teachers: [],
            },
          ],
        },
        items: [item],
        attendance: { rate: 0.95, sessions: 40, absent: 2, late: 1, excused: 0 },
        grades: [{ class: { id: "c1", code: "M7A", name: "Maths 7A", subject: { id: "m", code: "MATH", name: "Mathematics" } }, result: { mastery: 0.75, value: "15" }, reportingScale: { id: "r", name: "Marks" }, latest: { title: "Fractions", value: "15", scale: "Marks" } }],
        reports: [{ id: "r1", term: "Term 1", fileId: "f1", publishedAt: "2026-11-18T10:00:00Z" }],
        files: [],
      }),
    "/api/v1/portfolio/students/s1/items": (route) => json(route, { items: [item], nextCursor: null }),
    "/api/v1/portfolio/settings": (route) => json(route, { approvalRequired: true }),
  });
  await page.goto("/portfolio/s1");

  await expect(page.getByRole("heading", { level: 1, name: "Amira Haddad" })).toBeVisible();
  await expect(page.getByText("95%")).toBeVisible();
  await expect(page.getByText("Maths 7A").first()).toBeVisible();
  await expect(page.getByText("Latest: Fractions · 15")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reports: Term 1" })).toBeVisible();
  await expect(page.getByText("Lovely imagery.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add work" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/fee|invoice|balance/i);
  await expectNoAccessibilityViolations(page);
});

test("lets a teacher write report comments next to the term result", async ({ page }) => {
  let saved: unknown = null;
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "/api/v1/academics/years": (route) => json(route, [{ id: "y", name: "2026–2027", startsOn: "2026-09-01", endsOn: "2027-07-02", isCurrent: true }]),
    "/api/v1/academics/years/y/terms": (route) => json(route, [{ id: "t1", academicYearId: "y", name: "Term 1", startsOn: "2026-09-01", endsOn: "2026-12-18" }]),
    "/api/v1/academics/classes": (route) => json(route, [{ id: "c1", code: "M7A", name: "Maths 7A", academicYearId: "y", gradeLevel: null, subject: null, staff: [] }]),
    "GET /api/v1/reports/terms/t1/classes/c1": (route) =>
      json(route, { reportingScale: { id: "r", name: "Marks" }, rows: [{ student, status: "returned", returnNote: "Be more specific.", result: "15", comment: "Good." }] }),
    "PUT /api/v1/reports/terms/t1/classes/c1": (route) => {
      saved = route.request().postDataJSON();
      return json(route, { reportingScale: null, rows: [{ student, status: "returned", returnNote: "Be more specific.", result: "15", comment: "Good. Work on fractions." }] });
    },
  });
  await page.goto("/reports");

  await expect(page.getByText("Returned: Be more specific.")).toBeVisible();
  await expect(page.getByText("15", { exact: true })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByLabel("Comment for Amira Haddad").fill("Good. Work on fractions.");
  await page.getByRole("button", { name: "Save comments" }).click();
  await expect.poll(() => saved).toEqual({ comments: [{ studentId: "s1", comment: "Good. Work on fractions." }] });
});
