import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

const french = { kind: "points", maxPoints: 20, decimals: 1 };
const us = {
  kind: "letter",
  levels: [
    { code: "F", minMastery: 0 },
    { code: "C", minMastery: 0.7 },
    { code: "B", minMastery: 0.8 },
    { code: "A", minMastery: 0.9 },
  ],
};
const students = [
  { id: "s1", studentNumber: "S-1", firstName: "Amira", lastName: "Haddad", preferredName: null, status: "active", gradeLevel: null },
  { id: "s2", studentNumber: "S-2", firstName: "Lucas", lastName: "Martin", preferredName: null, status: "active", gradeLevel: null },
];
const assessment = {
  id: "a1",
  classId: "c1",
  title: "Fractions test",
  description: null,
  kind: "summative",
  dueOn: "2026-10-15",
  categoryId: null,
  weight: 1,
  scale: { id: "fr", name: "Note sur 20", version: 1, definition: french },
  criteria: [],
  standardIds: [],
};

test("lets a teacher grade a class with the keyboard and publish", async ({ page }) => {
  let saved: { grades: { studentId: string; value: string | null; comment: string | null }[]; publish: boolean } | null = null;
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "GET /api/v1/assessment/assessments/a1/grades": (route) =>
      json(route, {
        assessment,
        students,
        grades: [],
        submissions: [{ studentId: "s2", body: "Here is my work", submittedAt: "2026-10-16T08:00:00Z", isLate: true }],
        canPublish: true,
      }),
    "PUT /api/v1/assessment/assessments/a1/grades": (route) => {
      saved = route.request().postDataJSON();
      return json(route, {
        assessment,
        students,
        grades: saved!.grades.map((grade) => ({ ...grade, criterionValues: {}, excused: false, mastery: null, status: "published", publishedAt: null })),
        submissions: [],
        canPublish: true,
      });
    },
  });
  await page.goto("/assessments/a1");

  await expect(page.getByRole("heading", { level: 1, name: "Fractions test" })).toBeVisible();
  await expect(page.getByText("Use: 0–20")).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByLabel("Grade: Amira Haddad").fill("15,5");
  await page.getByLabel("Grade: Amira Haddad").press("Enter");
  await expect(page.getByLabel("Grade: Lucas Martin")).toBeFocused();
  await page.keyboard.type("9");
  await page.getByLabel("Comment: Amira Haddad").fill("Bon travail");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: /Submission from Lucas Martin/ }).click();
  await expect(page.getByText("Here is my work")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Save and publish" }).click();
  await expect.poll(() => saved).toMatchObject({
    publish: true,
    grades: [
      { studentId: "s1", value: "15,5", comment: "Bon travail" },
      { studentId: "s2", value: "9", comment: null },
    ],
  });
  await expect(page.getByText("Published").first()).toBeVisible();
});

test("shows a family the published grades in French, on the school's reporting scale", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "/api/v1/students/mine": (route) => json(route, [students[0]]),
    "/api/v1/assessment/students/s1/grades": (route) =>
      json(route, [
        {
          class: { id: "c1", code: "M7A", name: "Mathématiques 7A", subject: null },
          reportingScale: { id: "us", name: "Lettres" },
          result: { mastery: 0.81, value: "B" },
          assessments: [
            {
              id: "a1",
              title: "Contrôle fractions",
              description: null,
              kind: "summative",
              dueOn: "2026-10-15",
              scale: { id: "fr", name: "Note sur 20" },
              grade: { value: "15.5", reported: "C", comment: "Bon travail", excused: false, publishedAt: "2026-10-20T10:00:00Z" },
              submission: null,
            },
          ],
        },
      ]),
  });
  await page.goto("/fr/grades");

  await expect(page.getByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
  await expect(page.getByText("B sur Lettres")).toBeVisible();
  await expect(page.getByText("À rendre le 15 oct. 2026")).toBeVisible();
  await expect(page.getByText("C sur Lettres")).toBeVisible();
  await expect(page.getByText("Bon travail")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});

test("shows the gradebook with drafts marked and term results", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "/api/v1/academics/years": (route) => json(route, [{ id: "y1", name: "2026–2027", startsOn: "2026-09-01", endsOn: "2027-07-02", isCurrent: true }]),
    "/api/v1/academics/years/y1/terms": (route) => json(route, []),
    "/api/v1/assessment/classes/c1/gradebook": (route) =>
      json(route, {
        class: { id: "c1", code: "M7A", name: "Mathematics 7A", academicYearId: "y1", gradeLevel: null, subject: null, staff: [] },
        term: null,
        method: "weighted_average",
        reportingScale: { id: "us", name: "US letters", kind: "letter", version: 1, definition: us },
        categories: [],
        assessments: [{ id: "a1", title: "Fractions test", kind: "summative", dueOn: "2026-10-15", categoryId: null, weight: 1, scale: { id: "fr", name: "Note sur 20", kind: "points" } }],
        students,
        grades: [
          { assessmentId: "a1", studentId: "s1", value: "16", status: "published", excused: false, mastery: 0.8, criterionValues: {}, comment: null, publishedAt: null },
          { assessmentId: "a1", studentId: "s2", value: "9", status: "draft", excused: false, mastery: 0.45, criterionValues: {}, comment: null, publishedAt: null },
        ],
        results: [
          { studentId: "s1", mastery: 0.8, value: "B" },
          { studentId: "s2", mastery: null, value: null },
        ],
      }),
  });
  await page.goto("/classes/c1/gradebook");

  await expect(page.getByRole("heading", { level: 1, name: /Gradebook · Mathematics 7A/ })).toBeVisible();
  const amira = page.getByRole("row", { name: /Haddad, Amira/ });
  await expect(amira.getByRole("cell").last()).toHaveText("B");
  await expect(page.getByRole("row", { name: /Martin, Lucas/ })).toContainText("9 (Draft)");
  await expectNoAccessibilityViolations(page);
});

test("lets an admin set up a scale from a common scheme", async ({ page }) => {
  let created: unknown = null;
  await signIn(page, meFixture({ roles: ["admin"] }), {
    "/api/v1/grading/presets": (route) => json(route, [{ key: "us_letters", name: "US letter grades (A+ to F)", definition: us }]),
    "GET /api/v1/grading/scales": (route) => json(route, []),
    "POST /api/v1/grading/scales": (route) => {
      created = route.request().postDataJSON();
      return json(route, { id: "new", name: "Letters", kind: "letter", version: 1, definition: us }, 201);
    },
    "/api/v1/grading/conversions": (route) => json(route, []),
    "/api/v1/grading/policies": (route) => json(route, []),
    "/api/v1/academics/subjects": (route) => json(route, []),
  });
  await page.goto("/settings/grading");

  await expect(page.getByRole("heading", { name: "Grading scales" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Add scale" }).click();
  await page.getByLabel("Start from").click();
  await page.getByRole("option", { name: "US letter grades (A+ to F)" }).click();
  await expect(page.getByLabel("Code 4")).toHaveValue("A");
  await expect(page.getByLabel("From (%) 2")).toHaveValue("70");
  await page.getByLabel("Name", { exact: true }).fill("Letters");
  await page.getByRole("button", { name: "Save scale" }).click();

  await expect.poll(() => created).toEqual({ name: "Letters", definition: us });
});
