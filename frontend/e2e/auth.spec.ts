import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, mockApi, signIn } from "./support/mock-api";

test.describe("signing in", () => {
  test("sends signed-out visitors to sign in, then back where they were going", async ({ page }) => {
    await page.goto("/fr/settings/members");

    await expect(page).toHaveURL(/\/fr\/sign-in\?next=%2Fsettings%2Fmembers$/);
    await expect(page.getByRole("heading", { name: "Se connecter à Darsi" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("explains what is wrong with the form, in the user’s language", async ({ page }) => {
    await page.goto("/fr/sign-in");

    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText("Saisissez une adresse e-mail valide")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  });

  test("shows the API’s reason when the password is wrong", async ({ page }) => {
    await mockApi(page, {
      "POST /api/auth/sign-in/email": (route) =>
        json(route, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, 401),
    });
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("ada@greenfield.test");
    await page.getByLabel("Password").fill("not-my-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "match" })).toHaveText(
      "That email and password don’t match.",
    );
  });

  test("signs in and lands on the page that was asked for", async ({ page }) => {
    let signedIn = false;
    await mockApi(page, {
      "POST /api/auth/sign-in/email": async (route) => {
        signedIn = true;
        await page.context().addCookies([{ name: "darsi.session_token", value: "test", domain: "localhost", path: "/" }]);
        return json(route, { redirect: false, token: "t" });
      },
      "/api/v1/me": (route) => (signedIn ? json(route, meFixture()) : json(route, { code: "unauthenticated" }, 401)),
      "/api/v1/notifications/unread-count": (route) => json(route, { count: 0 }),
    });
    await page.goto("/sign-in?next=%2Fsettings%2Fschool");

    await page.getByLabel("Email").fill("ada@greenfield.test");
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/settings\/school$/);
    await expect(page.getByRole("heading", { name: "School profile" })).toBeVisible();
  });
});

test.describe("first admin", () => {
  test("is sent to onboarding until the school is set up", async ({ page }) => {
    await signIn(page, meFixture({ roles: ["admin"], onboardingCompleted: false }));
    await page.goto("/");

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Set up your school" })).toBeVisible();
    await expect(page.getByLabel("School name")).toHaveValue("Greenfield School");
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("people and roles", () => {
  test("lists members and pending invitations, and validates an invitation", async ({ page }) => {
    await signIn(page, meFixture(), {
      "/api/auth/organization/list-members": (route) =>
        json(route, {
          total: 2,
          members: [
            {
              id: "m1",
              organizationId: "s",
              userId: "0195e0a0-0000-7000-8000-0000000000aa",
              role: "admin,teacher",
              createdAt: "2026-09-01T08:00:00Z",
              user: { id: "u1", name: "Ada Lovelace", email: "ada@greenfield.test", image: null },
            },
            {
              id: "m2",
              organizationId: "s",
              userId: "u2",
              role: "teaching_assistant",
              createdAt: "2026-09-02T08:00:00Z",
              user: { id: "u2", name: "Grace Hopper", email: "grace@greenfield.test", image: null },
            },
          ],
        }),
      "/api/auth/organization/list-invitations": (route) =>
        json(route, [
          {
            id: "i1",
            organizationId: "s",
            email: "new.parent@example.test",
            role: "guardian",
            status: "pending",
            expiresAt: "2026-12-01T00:00:00Z",
            inviterId: "u1",
          },
        ]),
    });
    await page.goto("/settings/members");

    await expect(page.getByText("grace@greenfield.test")).toBeVisible();
    await expect(page.getByText("Teaching assistant")).toBeVisible();
    await expect(page.getByText("new.parent@example.test")).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Invite people" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("Choose at least one role")).toBeVisible();
  });
});
