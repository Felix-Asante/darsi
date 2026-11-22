import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

const NOW = new Date("2026-11-19T08:40:00Z");
const invoice = {
  id: "inv1",
  status: "issued",
  number: "INV-000042",
  reference: "Term 1",
  familyId: "fam1",
  familyName: "Haddad family",
  currency: "EUR",
  issueDate: "2026-11-01",
  dueDate: "2026-11-30",
  subtotal: "960000",
  discountTotal: "45000",
  taxTotal: "3300",
  total: "918300",
  credited: "0",
  paid: "400000",
  balance: "518300",
  state: "partially_paid",
};
const payment = {
  id: "pay1",
  familyId: "fam1",
  familyName: "Haddad family",
  receipt: "RCT-000007",
  amount: "400000",
  currency: "EUR",
  method: "transfer",
  reference: "VIR-1",
  receivedOn: "2026-11-05",
  allocations: [
    { invoiceId: "inv1", invoiceNumber: "INV-000042", amount: "400000" },
  ],
  refunded: "0",
  credit: "0",
  refunds: [],
};
const year = {
  id: "y",
  name: "2026–2027",
  startsOn: "2026-09-01",
  endsOn: "2027-07-02",
  isCurrent: true,
};
const term = {
  id: "t1",
  academicYearId: "y",
  name: "Term 1",
  startsOn: "2026-09-01",
  endsOn: "2026-12-18",
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("shows a guardian what is owed and sends them to the card payment page once (FEE-10, FEE-12)", async ({
  page,
}) => {
  const keys: string[] = [];
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "/api/v1/billing/statements": (route) =>
      json(route, [
        {
          familyId: "fam1",
          familyName: "Haddad family",
          balance: "518300",
          credit: "0",
          invoices: [invoice],
          payments: [payment],
        },
      ]),
    "POST /api/v1/billing/invoices/inv1/checkout": (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      return json(route, { url: "https://checkout.stripe.test/session" });
    },
  });
  await page.route("https://checkout.stripe.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Stripe</title>" }),
  );
  await page.goto("/billing");

  await expect(
    page.getByRole("heading", { level: 1, name: "Fees and payments" }),
  ).toBeVisible();
  await expect(page.getByText("€5,183.00").first()).toBeVisible();
  await expect(page.getByText("Partly paid")).toBeVisible();
  await expect(page.locator("code", { hasText: "RCT-000007" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Pay by card INV-000042" }).click();
  await expect(page).toHaveURL("https://checkout.stripe.test/session");
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
});

test("formats a family's balance in French", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "/api/v1/billing/statements": (route) =>
      json(route, [
        {
          familyId: "fam1",
          familyName: "Famille Haddad",
          balance: "518300",
          credit: "0",
          invoices: [invoice],
          payments: [],
        },
      ]),
  });
  await page.goto("/fr/billing");
  await expect(
    page.getByRole("heading", { level: 1, name: "Frais et paiements" }),
  ).toBeVisible();
  await expect(page.getByText(/5\s183,00\s€/).first()).toBeVisible();
  await expect(page.getByText("Partiellement réglée")).toBeVisible();
});

test("previews an invoice run, then issues only the new families (FEE-5)", async ({
  page,
}) => {
  let ran: unknown = null;
  await signIn(page, meFixture({ roles: ["finance_officer"] }), {
    "/api/v1/academics/years": (route) => json(route, [year]),
    "/api/v1/academics/years/y/terms": (route) => json(route, [term]),
    "POST /api/v1/billing/runs/preview": (route) =>
      json(route, {
        periodKey: "term:t1",
        families: [
          {
            familyId: "fam1",
            familyName: "Haddad family",
            students: 2,
            total: "918300",
            alreadyInvoiced: false,
          },
          {
            familyId: "fam2",
            familyName: "Martin family",
            students: 1,
            total: "480000",
            alreadyInvoiced: true,
          },
        ],
        withoutFamily: ["Léa Petit"],
        total: "918300",
      }),
    "POST /api/v1/billing/runs": (route) => {
      ran = route.request().postDataJSON();
      return json(route, {
        periodKey: "term:t1",
        issued: 1,
        skipped: 1,
        withoutFamily: [],
      });
    },
  });
  await page.goto("/billing/runs");

  await page.getByLabel("Term").click();
  await page.getByRole("option", { name: "Term 1" }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.getByRole("heading", { name: "1 family to invoice" }),
  ).toBeVisible();
  await expect(page.getByText("Already invoiced")).toBeVisible();
  await expect(page.getByText(/Léa Petit/)).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Issue 1 invoice" }).click();
  await expect(page.getByText("1 invoice issued, 1 skipped")).toBeVisible();
  expect(ran).toEqual({ academicYearId: "y", schedule: "term", termId: "t1" });
});

test("records an offline payment in minor units, never floats (FEE-11)", async ({
  page,
}) => {
  let recorded: Record<string, unknown> | null = null;
  await signIn(page, meFixture({ roles: ["finance_officer"] }), {
    "/api/v1/billing/families": (route) =>
      json(route, [
        {
          familyId: "fam1",
          familyName: "Haddad family",
          balance: "518300",
          credit: "0",
        },
      ]),
    "GET /api/v1/billing/payments": (route) => json(route, [payment]),
    "POST /api/v1/billing/payments": (route) => {
      recorded = route.request().postDataJSON();
      return json(
        route,
        {
          ...payment,
          id: "pay2",
          receipt: "RCT-000008",
          amount: "520000",
          credit: "1700",
        },
        201,
      );
    },
  });
  await page.goto("/billing/payments");

  await page.getByLabel("Family").click();
  await page.getByRole("option", { name: "Haddad family" }).click();
  await page.getByLabel("Amount (EUR)").fill("5 200,00");
  await page.getByLabel("Reference").fill("VIR-2");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(
    page.getByText("Payment recorded. Receipt RCT-000008"),
  ).toBeVisible();
  await expect(page.getByText("€17.00 kept as credit")).toBeVisible();
  expect(recorded).toMatchObject({
    familyId: "fam1",
    amount: "520000",
    method: "transfer",
    reference: "VIR-2",
    receivedOn: "2026-11-19",
  });
  await expectNoAccessibilityViolations(page);
});

test("shows outstanding balances by age of debt (FEE-17)", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["finance_officer"] }), {
    "/api/v1/academics/divisions": (route) => json(route, []),
    "/api/v1/billing/reports/outstanding": (route) =>
      json(route, {
        currency: "EUR",
        totals: {
          current: "0",
          "0_30": "518300",
          "31_60": "0",
          "61_90": "0",
          "90_plus": "12000",
          total: "530300",
        },
        families: [
          {
            familyId: "fam1",
            familyName: "Haddad family",
            gradeLevelIds: [],
            total: "518300",
            buckets: {
              current: "0",
              "0_30": "518300",
              "31_60": "0",
              "61_90": "0",
              "90_plus": "0",
            },
          },
          {
            familyId: "fam2",
            familyName: "Martin family",
            gradeLevelIds: [],
            total: "12000",
            buckets: {
              current: "0",
              "0_30": "0",
              "31_60": "0",
              "61_90": "0",
              "90_plus": "12000",
            },
          },
        ],
      }),
    "/api/v1/billing/reports/collections": (route) =>
      json(route, [
        { month: "2026-11", received: "400000", refunded: "0", net: "400000" },
      ]),
  });
  await page.goto("/billing/reports");

  await expect(
    page.getByRole("heading", { level: 1, name: "Finance reports" }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Martin family/ })).toContainText(
    "€120.00",
  );
  await expect(page.getByRole("row", { name: /^Total/ })).toContainText(
    "€5,303.00",
  );
  await expect(page.getByText("November 2026")).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("keeps fees away from teachers", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["teacher"] }));
  await page.goto("/billing/reports");
  await expect(
    page.getByText("Only the finance office can see this page."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0);
});
