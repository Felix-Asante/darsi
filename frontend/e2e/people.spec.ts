import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

const GRADE = { id: "0195e0a0-0000-7000-8000-0000000000g7", name: "Grade 7" };
const amira = {
  id: "0195e0a0-0000-7000-8000-0000000000s1",
  studentNumber: "S-0001",
  firstName: "Amira",
  lastName: "Haddad",
  preferredName: null,
  status: "active",
  gradeLevel: GRADE,
};
const year = { id: "0195e0a0-0000-7000-8000-0000000000y1", name: "2026–2027", startsOn: "2026-09-01", endsOn: "2027-07-02", isCurrent: true };
const mathClass = {
  id: "0195e0a0-0000-7000-8000-0000000000c1",
  code: "M7A",
  name: "Mathematics 7A",
  academicYearId: year.id,
  gradeLevel: GRADE,
  subject: { id: "0195e0a0-0000-7000-8000-0000000000m1", code: "MATH", name: "Mathematics" },
  staff: [{ userId: "u1", role: "teacher", name: "Ada Lovelace", email: "ada@greenfield.test" }],
};
const structure = {
  "/api/v1/academics/years": (route: Parameters<typeof json>[0]) => json(route, [year]),
  "/api/v1/academics/divisions": (route: Parameters<typeof json>[0]) =>
    json(route, [{ id: "d1", name: "Middle", sortOrder: 0, gradeLevels: [{ ...GRADE, divisionId: "d1", sortOrder: 0 }] }]),
  "/api/v1/academics/subjects": (route: Parameters<typeof json>[0]) => json(route, [mathClass.subject]),
};

test.describe("students", () => {
  test("lists students and opens a profile with guardians and classes", async ({ page }) => {
    await signIn(page, meFixture(), {
      ...structure,
      "/api/v1/students": (route) => json(route, { items: [amira], nextCursor: null }),
      [`/api/v1/students/${amira.id}`]: (route) =>
        json(route, {
          ...amira,
          dateOfBirth: "2013-05-01",
          email: null,
          enrolledOn: "2026-09-01",
          withdrawnOn: null,
          family: { id: "f1", name: "Haddad family" },
          guardians: [
            {
              id: "g1",
              firstName: "Leila",
              lastName: "Haddad",
              email: "leila@example.test",
              phone: null,
              preferredLocale: "fr",
              hasAccount: true,
              relationship: "mother",
              isPrimaryContact: true,
            },
          ],
          siblings: [],
          classes: [{ ...mathClass, enrolledSince: "2026-09-01" }],
        }),
    });
    await page.goto("/students");

    await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: "Haddad, Amira" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Amira Haddad" })).toBeVisible();
    await expect(page.getByText("May 1, 2013")).toBeVisible();
    await expect(page.getByText("Leila Haddad")).toBeVisible();
    await expect(page.getByText("Primary contact")).toBeVisible();
    await expect(page.getByRole("link", { name: "Mathematics 7A" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("shows French dates and labels", async ({ page }) => {
    await signIn(page, meFixture(), {
      ...structure,
      [`/api/v1/students/${amira.id}`]: (route) =>
        json(route, {
          ...amira,
          dateOfBirth: "2013-05-01",
          email: null,
          enrolledOn: null,
          withdrawnOn: null,
          family: null,
          guardians: [],
          siblings: [],
          classes: [],
        }),
    });
    await page.goto(`/fr/students/${amira.id}`);

    await expect(page.getByText("1 mai 2013")).toBeVisible();
    await expect(page.getByText("Aucun responsable associé pour l’instant.")).toBeVisible();
  });
});

test.describe("classes", () => {
  test("shows a teacher their class and its roster", async ({ page }) => {
    await signIn(page, meFixture({ roles: ["teacher"] }), {
      ...structure,
      "/api/v1/academics/classes": (route) => json(route, [mathClass]),
      [`/api/v1/academics/classes/${mathClass.id}`]: (route) => json(route, mathClass),
      [`/api/v1/academics/classes/${mathClass.id}/students`]: (route) => json(route, [amira]),
    });
    await page.goto("/classes");

    await expect(page.getByRole("heading", { level: 1, name: /Classes/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "New class" })).toHaveCount(0);
    await page.getByRole("link", { name: "Mathematics 7A" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Mathematics 7A" })).toBeVisible();
    await expect(page.getByText("1 student")).toBeVisible();
    await expect(page.getByRole("link", { name: "Haddad, Amira" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enrol students" })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("imports", () => {
  test("lists the rows to fix after an import", async ({ page }) => {
    await signIn(page, meFixture({ roles: ["admin"] }), {
      "/api/v1/imports/columns": (route) =>
        json(route, {
          students: { required: ["student_number", "first_name", "last_name"], optional: ["grade_level"] },
          guardians: { required: ["email"], optional: [] },
          classes: { required: ["code", "name"], optional: [] },
          enrolments: { required: ["student_number", "class_code"], optional: [] },
          standards: { required: ["framework_code", "code", "description"], optional: [] },
        }),
      "/api/v1/imports": (route) =>
        json(route, [
          {
            id: "j1",
            kind: "students",
            status: "completed",
            fileName: "students.csv",
            totalRows: 503,
            importedRows: 500,
            failedRows: 3,
            errors: [
              { row: 502, field: "date_of_birth", code: "isCalendarDate" },
              { row: 504, field: "grade_level", code: "gradeLevelNotFound" },
            ],
            createdAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          },
        ]),
    });
    await page.goto("/settings/imports");

    await expect(page.getByText("500 of 503 rows imported")).toBeVisible();
    await page.getByText("Rows to fix").click();
    await expect(page.getByRole("cell", { name: "502" })).toBeVisible();
    await expect(page.getByText("Not a valid date. Use YYYY-MM-DD.")).toBeVisible();
    await expect(page.getByText("student_number")).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});
