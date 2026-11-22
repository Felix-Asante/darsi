import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

const NOW = new Date("2026-11-19T08:40:00Z");
const STATUSES = ["present", "absent", "late", "excused"].map((code) => ({ code, label: null, countsAs: code }));
const students = Array.from({ length: 30 }, (_, index) => ({
  id: `s${index}`,
  studentNumber: `S-${index}`,
  firstName: `Kid${String(index).padStart(2, "0")}`,
  lastName: "Martin",
  preferredName: null,
  status: "active",
  gradeLevel: null,
}));
const sheet = (records: Record<string, string> = {}) => ({
  mode: "daily",
  date: "2026-11-19",
  periodId: null,
  dayOff: false,
  closed: false,
  taken: null,
  statuses: STATUSES,
  students: students.map((student) => ({ student, status: records[student.id] ?? "present", reason: null, reasonSource: null })),
});
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("takes attendance for 30 students by marking only the exceptions", async ({ page }) => {
  let saved: { date: string; records: { studentId: string; status: string; reason: string | null }[] } | null = null;
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "GET /api/v1/attendance/classes/c1": (route) => json(route, sheet()),
    "PUT /api/v1/attendance/classes/c1": (route) => {
      saved = route.request().postDataJSON();
      return json(route, sheet(Object.fromEntries(saved!.records.map((record) => [record.studentId, record.status]))));
    },
  });
  await page.goto("/attendance/classes/c1?date=2026-11-19");

  await expect(page.getByRole("heading", { level: 1, name: "Attendance" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Present" })).toHaveCount(30);
  await expectNoAccessibilityViolations(page);

  await page.getByRole("group", { name: "Status for Kid03 Martin" }).getByText("Absent").click();
  await page.getByRole("group", { name: "Status for Kid07 Martin" }).getByText("Late").click();
  await page.getByLabel("Reason for Kid07 Martin").fill("Bus");
  await expect(page.getByText("1 absent · 1 late")).toBeVisible();
  await page.getByRole("button", { name: "Save attendance" }).click();

  await expect.poll(() => saved).toEqual({
    date: "2026-11-19",
    periodId: null,
    records: [
      { studentId: "s3", status: "absent", reason: null },
      { studentId: "s7", status: "late", reason: "Bus" },
    ],
  });
  await expect(page.getByText("Attendance saved")).toBeVisible();
});

test("shows announcements in French and lets a teacher post to a class", async ({ page }) => {
  let posted: unknown = null;
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "GET /api/v1/announcements": (route) =>
      json(route, {
        items: [
          {
            id: "a1",
            title: "Sortie au musée",
            body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Prévoir un pique-nique", marks: [{ type: "bold" }] }] }] },
            audience: "class",
            audienceId: "c1",
            audienceRole: null,
            audienceName: "Classe 7A",
            author: { id: "u1", name: "Ada Lovelace" },
            publishAt: "2026-11-18T07:00:00Z",
            publishedAt: "2026-11-18T07:00:00Z",
            canDelete: true,
          },
        ],
        nextCursor: null,
      }),
    "/api/v1/announcements/scheduled": (route) => json(route, []),
    "/api/v1/academics/classes": (route) =>
      json(route, [{ id: "c1", code: "7A", name: "Classe 7A", academicYearId: "y", gradeLevel: null, subject: null, staff: [] }]),
    "POST /api/v1/announcements": (route) => {
      posted = route.request().postDataJSON();
      return json(route, {}, 201);
    },
  });
  await page.goto("/fr/announcements");

  await expect(page.getByRole("heading", { level: 2, name: "Sortie au musée" })).toBeVisible();
  await expect(page.getByText("À : Classe 7A")).toBeVisible();
  await expect(page.locator("strong", { hasText: "Prévoir un pique-nique" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Nouvelle annonce" }).click();
  await page.getByLabel("Laquelle").click();
  await page.getByRole("option", { name: "Classe 7A" }).click();
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("Contrôle vendredi");
  await page.getByRole("textbox", { name: "Message" }).click();
  await page.keyboard.type("Révisez le chapitre 3");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();

  await expect.poll(() => posted).toEqual({
    title: "Contrôle vendredi",
    body: doc("Révisez le chapitre 3"),
    audience: "class",
    audienceId: "c1",
    audienceRole: null,
    publishAt: null,
  });
});

test("lets a guardian choose to be told about absences only in the app", async ({ page }) => {
  let saved: unknown = null;
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "GET /api/v1/notifications/preferences": (route) =>
      json(route, [
        { type: "announcement.published", inApp: true, email: true },
        { type: "attendance.absence", inApp: true, email: true },
        { type: "grade.published", inApp: true, email: true },
      ]),
    "PUT /api/v1/notifications/preferences": (route) => {
      saved = route.request().postDataJSON();
      return json(route, {});
    },
  });
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { level: 1, name: "Notification settings" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("checkbox", { name: "Absences: By email" }).click();
  await expect.poll(() => saved).toEqual({ type: "attendance.absence", inApp: true, email: false });
});

test("adds a lesson with formatted text to a unit", async ({ page }) => {
  const unit = {
    id: "u1",
    title: "Ecosystems",
    templateId: null,
    startsOn: "2026-11-02",
    endsOn: "2026-12-11",
    objectives: doc("Explain food webs"),
    fieldValues: {},
    updatedAt: "2026-11-18T10:00:00Z",
    access: "owner",
    createdBy: { id: "u", name: "Ada Lovelace" },
    updatedBy: { id: "u", name: "Ada Lovelace" },
    classes: [{ id: "c1", code: "S7A", name: "Science 7A", academicYearId: "y", gradeLevel: null, subject: null, staff: [] }],
    standardIds: [],
    assessmentIds: [],
    collaborators: [],
    lessons: [],
  };
  let lesson: unknown = null;
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "/api/v1/planning/units/u1": (route) => json(route, unit),
    "/api/v1/planning/templates": (route) => json(route, []),
    "/api/v1/assessment/classes/c1/assessments": (route) => json(route, []),
    "POST /api/v1/planning/units/u1/lessons": (route) => {
      lesson = route.request().postDataJSON();
      return json(route, { ...unit, lessons: [{ id: "l1", sortOrder: 0, updatedAt: unit.updatedAt, updatedBy: unit.updatedBy, ...lesson! as object }] }, 201);
    },
  });
  await page.goto("/planning/units/u1");

  await expect(page.getByRole("heading", { level: 1, name: "Ecosystems" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Add lesson" }).click();
  await page.getByLabel("Lesson title").fill("Food chains");
  await page.getByRole("textbox", { name: "Activities" }).click();
  await page.getByRole("toolbar", { name: "Formatting for Activities" }).getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("Card sort");
  await page.getByRole("button", { name: "Save lesson" }).click();

  await expect.poll(() => lesson).toMatchObject({
    title: "Food chains",
    activities: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Card sort", marks: [{ type: "bold" }] }] }] },
  });
  await expect(page.getByRole("heading", { level: 3, name: "Food chains" })).toBeVisible();
});
