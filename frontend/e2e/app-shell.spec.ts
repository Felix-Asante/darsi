import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { meFixture, signIn } from "./support/mock-api";

test.describe("app shell", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("serves English by default, without a locale prefix", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Today · Darsi");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("serves French under /fr", async ({ page }) => {
    await page.goto("/fr");

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1, name: "Aujourd’hui" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("switches language and keeps the user on the same page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^Language/ }).click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("heading", { level: 1, name: "Aujourd’hui" })).toBeVisible();
  });

  test("shows a translated 404 for unknown pages", async ({ page }) => {
    const response = await page.goto("/fr/does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("navigation", () => {
  test("is reachable on desktop and marks the current page", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop sidebar");
    await signIn(page);
    await page.goto("/");

    const today = page.getByRole("link", { name: "Today" });
    await expect(today).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Gradebook" })).toBeVisible();
    await expect(page.getByText("Greenfield School")).toBeVisible();
  });

  test("shows a guardian only what guardians use", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop sidebar");
    await signIn(page, meFixture({ roles: ["guardian"] }));
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Billing" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gradebook" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });

  test("opens from the menu button on a phone", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile sheet");
    await signIn(page);
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Gradebook" })).toBeHidden();
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(page.getByRole("link", { name: "Gradebook" })).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

test("sends security headers with every page", async ({ page }) => {
  await signIn(page);
  const response = await page.goto("/");
  const headers = response!.headers();

  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});
