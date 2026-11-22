import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, mockApi, signIn } from "./support/mock-api";

const NOW = new Date("2026-11-19T08:40:00Z");
const stages = [
  { id: "s1", name: "Submitted", kind: "submitted", sortOrder: 0, email: null },
  { id: "s2", name: "Interview", kind: "interview", sortOrder: 1, email: null },
  {
    id: "s3",
    name: "Offered",
    kind: "offered",
    sortOrder: 2,
    email: {
      en: { subject: "An offer for {student}", body: "Welcome to {school}." },
    },
  },
  { id: "s4", name: "Accepted", kind: "accepted", sortOrder: 3, email: null },
  { id: "s5", name: "Enrolled", kind: "enrolled", sortOrder: 4, email: null },
  { id: "s6", name: "Declined", kind: "declined", sortOrder: 5, email: null },
];
const form = {
  fields: [
    {
      key: "previous_school",
      label: { en: "Previous school", fr: "École précédente" },
      type: "text",
      required: true,
    },
  ],
  documents: [
    {
      key: "birth_certificate",
      label: { en: "Birth certificate", fr: "Acte de naissance" },
      required: true,
    },
  ],
};
const draft = {
  id: "a1",
  status: "draft",
  cycle: { id: "c1", name: "Entry 2027", applicationFee: "5000" },
  gradeLevel: { id: "g7", name: "Grade 7" },
  stage: null,
  student: {
    firstName: "Amira",
    lastName: "Haddad",
    preferredName: null,
    dateOfBirth: "2014-03-02",
  },
  guardian: {
    firstName: "Nadia",
    lastName: "Haddad",
    phone: null,
    relationship: "mother",
  },
  answers: {},
  form,
  documents: [],
  submittedAt: null,
  feeInvoiceId: null,
  offer: null,
};
const summary = {
  id: "a1",
  cycleId: "c1",
  gradeLevel: { id: "g7", name: "Grade 7" },
  stageId: "s1",
  student: {
    firstName: "Amira",
    lastName: "Haddad",
    dateOfBirth: "2014-03-02",
  },
  guardian: { name: "Nadia Haddad", email: "nadia@example.test" },
  submittedAt: "2026-11-10T09:00:00Z",
  offerExpiresOn: null,
  offerResponse: null,
  studentId: null,
  notes: 1,
  rating: 4,
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("shows the public application page, in French, without signing in (ADMS-3)", async ({
  page,
}) => {
  await mockApi(page, {
    "/api/v1/admissions/public": (route) =>
      json(route, {
        school: {
          name: "École Greenfield",
          logo: null,
          defaultLocale: "fr",
          currency: "EUR",
        },
        cycles: [
          {
            id: "c1",
            name: "Rentrée 2027",
            closesOn: "2026-12-19",
            applicationFee: "5000",
            grades: [{ id: "g7", name: "5e" }],
          },
        ],
      }),
  });
  await page.goto("/fr/apply");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Candidater à École Greenfield",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Candidatures jusqu’au 19 décembre 2026 · frais de candidature 50,00\s€/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Créer un compte pour candidater" }),
  ).toHaveAttribute("href", /\/fr\/sign-up\?next=%2Fapply%2Fstart/);
  await expectNoAccessibilityViolations(page);
});

test("lists what is missing before a family can submit (ADMS-4)", async ({
  page,
}) => {
  let saved: Record<string, unknown> | null = null;
  await signIn(page, meFixture({ roles: ["applicant"] }), {
    "GET /api/v1/admissions/my-applications/a1": (route) => json(route, draft),
    "PUT /api/v1/admissions/my-applications/a1": (route) => {
      saved = route.request().postDataJSON();
      return json(route, draft);
    },
    "POST /api/v1/admissions/my-applications/a1/submit": (route) =>
      json(
        route,
        {
          status: 422,
          code: "validation_failed",
          errors: [
            { field: "answers.previous_school", codes: ["required"] },
            { field: "documents.birth_certificate", codes: ["required"] },
          ],
        },
        422,
      ),
  });
  await page.goto("/applications/a1");

  await expect(
    page.getByRole("heading", { level: 1, name: /Application for Grade 7/ }),
  ).toBeVisible();
  await page.getByLabel(/Previous school/).fill("École Jules Ferry");
  await expect(
    page.getByRole("button", { name: "Upload Birth certificate" }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Submit application" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Please complete" });
  await expect(alert).toContainText("Previous school");
  await expect(alert).toContainText("Birth certificate");
  expect(saved).toMatchObject({
    cycleId: "c1",
    gradeLevelId: "g7",
    studentFirstName: "Amira",
    answers: { previous_school: "École Jules Ferry" },
  });
});

test("lets a family accept an offer before it expires (ADMS-9)", async ({
  page,
}) => {
  let response: unknown = null;
  await signIn(page, meFixture({ roles: ["applicant"] }), {
    "GET /api/v1/admissions/my-applications/a1": (route) =>
      json(route, {
        ...draft,
        status: "submitted",
        stage: stages[2],
        submittedAt: "2026-11-10T09:00:00Z",
        feeInvoiceId: "inv1",
        offer: { expiresOn: "2026-12-03", response: null },
      }),
    "POST /api/v1/admissions/my-applications/a1/offer": (route) => {
      response = route.request().postDataJSON();
      return json(route, {
        ...draft,
        status: "submitted",
        stage: stages[3],
        offer: { expiresOn: "2026-12-03", response: "accepted" },
      });
    },
  });
  await page.goto("/applications/a1");

  await expect(
    page.getByRole("heading", {
      name: "The school offers Amira Haddad a place",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Please reply by December 3, 2026."),
  ).toBeVisible();
  await expect(
    page.getByText("The application fee has been invoiced."),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Accept the place" }).click();
  await expect(
    page.getByText("Offer accepted. The school will be in touch."),
  ).toBeVisible();
  expect(response).toEqual({ response: "accepted" });
});

test("shows the admissions office a board by stage and moves applications (ADMS-6)", async ({
  page,
}) => {
  let moved: unknown = null;
  await signIn(page, meFixture({ roles: ["admissions_officer"] }), {
    "/api/v1/admissions/cycles": (route) =>
      json(route, [
        {
          id: "c1",
          academicYearId: "y",
          name: "Entry 2027",
          opensOn: "2026-11-01",
          closesOn: "2026-12-19",
          grades: [{ gradeLevelId: "g7", places: 24 }],
          applicationFee: "5000",
          depositFeeItemId: null,
        },
      ]),
    "/api/v1/admissions/stages": (route) => json(route, stages),
    "/api/v1/academics/divisions": (route) =>
      json(route, [
        {
          id: "d",
          name: "Middle School",
          sortOrder: 0,
          gradeLevels: [
            { id: "g7", divisionId: "d", name: "Grade 7", sortOrder: 0 },
          ],
        },
      ]),
    "/api/v1/admissions/applications": (route) => json(route, [summary]),
    "POST /api/v1/admissions/applications/a1/move": (route) => {
      moved = route.request().postDataJSON();
      return json(route, {});
    },
  });
  await page.goto("/admissions");

  const submitted = page
    .getByRole("region", { name: "Applications by stage" })
    .getByRole("region", { name: /Submitted/ });
  await expect(
    submitted.getByRole("link", { name: "Amira Haddad" }),
  ).toBeVisible();
  await expect(submitted.getByText("Rated 4")).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page
    .getByRole("combobox", { name: "Move Amira Haddad to another stage" })
    .click();
  await expect(page.getByRole("option", { name: "Offered" })).toHaveCount(0);
  await page.getByRole("option", { name: "Interview" }).click();
  await expect.poll(() => moved).toEqual({ stageId: "s2" });

  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByRole("row", { name: /Amira Haddad/ })).toContainText(
    "Nadia Haddad",
  );
  await expectNoAccessibilityViolations(page);
});

test("keeps staff notes on the office side and makes an offer with an expiry date (ADMS-7, ADMS-9)", async ({
  page,
}) => {
  let moved: unknown = null;
  const staffView = {
    ...draft,
    status: "submitted",
    stage: stages[1],
    submittedAt: "2026-11-10T09:00:00Z",
    answers: { previous_school: "École Jules Ferry" },
    guardianEmail: "nadia@example.test",
    familyId: "f1",
    studentId: null,
    documents: [
      {
        key: "birth_certificate",
        file: {
          id: "f",
          name: "birth.pdf",
          contentType: "application/pdf",
          sizeBytes: 100,
          status: "available",
          preview: "pdf",
        },
      },
    ],
    notes: [
      {
        id: "n1",
        kind: "interview",
        body: "Curious and articulate.",
        rating: null,
        author: "Ada Lovelace",
        createdAt: "2026-11-12T10:00:00Z",
      },
    ],
  };
  await signIn(page, meFixture({ roles: ["admissions_officer"] }), {
    "/api/v1/admissions/applications/a1": (route) => json(route, staffView),
    "/api/v1/admissions/stages": (route) => json(route, stages),
    "POST /api/v1/admissions/applications/a1/move": (route) => {
      moved = route.request().postDataJSON();
      return json(route, { ...staffView, stage: stages[2] });
    },
  });
  await page.goto("/admissions/applications/a1");

  await expect(
    page.getByRole("heading", { level: 1, name: /Amira Haddad/ }),
  ).toBeVisible();
  await expect(page.getByText("Curious and articulate.")).toBeVisible();
  await expect(
    page.getByText("Only staff see notes, ratings and interview results."),
  ).toBeVisible();
  await expect(page.getByText("École Jules Ferry")).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByLabel("Move to").click();
  await page.getByRole("option", { name: "Offered" }).click();
  await expect(
    page.getByText("The family will receive this stage’s email."),
  ).toBeVisible();
  await page.getByLabel("Offer expires on").fill("2026-12-03");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByText("Moved to Offered")).toBeVisible();
  expect(moved).toEqual({ stageId: "s3", offerExpiresOn: "2026-12-03" });
});

test("shows the stage email placeholders literally (ADMS-8)", async ({
  page,
}) => {
  await signIn(page, meFixture({ roles: ["admissions_officer"] }), {
    "/api/v1/admissions/cycles": (route) => json(route, []),
    "/api/v1/admissions/forms": (route) => json(route, []),
    "/api/v1/admissions/stages": (route) => json(route, stages),
    "/api/v1/academics/years": (route) => json(route, []),
    "/api/v1/academics/divisions": (route) => json(route, []),
  });
  await page.goto("/admissions/settings");
  await expect(
    page.getByText("In emails, {student} becomes the child’s name"),
  ).toBeVisible();
  await expect(page.getByLabel("Subject in English")).toHaveValue(
    "An offer for {student}",
  );
  await expectNoAccessibilityViolations(page);
});

test("lets a guardian confirm next year's place (ADMS-13)", async ({
  page,
}) => {
  let answer: unknown = null;
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "/api/v1/admissions/re-enrolments/mine": (route) =>
      json(route, [
        {
          id: "r1",
          academicYearId: "y2",
          student: {
            id: "s",
            name: "Lina Martin",
            gradeLevel: { id: "g6", name: "Grade 6" },
          },
          nextGradeLevel: { id: "g7", name: "Grade 7" },
          status: answer ? "confirmed" : "pending",
          respondedAt: null,
        },
      ]),
    "POST /api/v1/admissions/re-enrolments/r1/respond": (route) => {
      answer = route.request().postDataJSON();
      return json(route, {});
    },
  });
  await page.goto("/re-enrolment");
  await expect(page.getByText("Next year in Grade 7")).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page
    .getByRole("button", { name: "Confirm the place Lina Martin" })
    .click();
  await expect(page.getByText("Place confirmed").first()).toBeVisible();
  expect(answer).toEqual({ response: "confirmed" });
});
