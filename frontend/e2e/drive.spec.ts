import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./support/axe";
import { json, meFixture, signIn } from "./support/mock-api";

const file = (id: string, name: string, status = "available") => ({
  id,
  name,
  contentType: "application/pdf",
  sizeBytes: 1536,
  status,
  preview: "pdf",
});
const folder = { id: "f1", classId: "c1", parentId: null, kind: "folder", name: "Homework", visibility: ["student", "guardian"], file: null, updatedAt: "2026-11-18T10:00:00Z" };

test("lets a teacher browse, upload and see what each audience sees", async ({ page }) => {
  let uploaded: unknown = null;
  let stored = "";
  await signIn(page, meFixture({ roles: ["teacher"] }), {
    "/api/v1/academics/classes/c1": (route) =>
      json(route, { id: "c1", code: "7A", name: "Class 7A", academicYearId: "y", gradeLevel: null, subject: null, staff: [] }),
    "GET /api/v1/drive/classes/c1": (route) =>
      json(route, {
        access: { manage: true, delete: true },
        path: [],
        items: [
          folder,
          { id: "i1", classId: "c1", parentId: null, kind: "file", name: "answers.pdf", visibility: [], file: file("file1", "answers.pdf"), updatedAt: "2026-11-18T10:00:00Z" },
          { id: "i2", classId: "c1", parentId: null, kind: "file", name: "new.pdf", visibility: [], file: file("file2", "new.pdf", "scanning"), updatedAt: "2026-11-18T10:00:00Z" },
        ],
      }),
    "POST /api/v1/files/uploads": (route) => {
      uploaded = route.request().postDataJSON();
      return json(route, { file: file("file3", "plan.pdf", "pending"), uploadUrl: "https://storage.test/quarantine/file3?signed" }, 201);
    },
    "POST /api/v1/files/file3/complete": (route) => json(route, file("file3", "plan.pdf", "scanning")),
  });
  await page.route("https://storage.test/**", async (route) => {
    stored = route.request().postData() ?? "";
    await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto("/classes/c1/drive");

  await expect(page.getByRole("heading", { level: 1, name: "Class drive" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Homework" })).toBeVisible();
  await expect(page.getByText("Staff only").first()).toBeVisible();
  await expect(page.getByText("Checking for viruses…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download answers.pdf" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.locator('input[type="file"]').setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 plan") });
  await expect.poll(() => uploaded).toEqual({
    name: "plan.pdf",
    contentType: "application/pdf",
    size: 13,
    target: { type: "drive", classId: "c1", parentId: null },
  });
  await expect.poll(() => stored).toBe("%PDF-1.4 plan");
  await expect(page.getByText("File uploaded. It will appear once checked for viruses.")).toBeVisible();
});

test("shows a guardian the files without staff controls, in French", async ({ page }) => {
  await signIn(page, meFixture({ roles: ["guardian"] }), {
    "GET /api/v1/drive/classes/c1": (route, url) =>
      json(route, {
        access: { manage: false, delete: false },
        path: url.searchParams.get("folderId") ? [{ id: "f1", name: "Homework" }] : [],
        items: url.searchParams.get("folderId")
          ? [{ id: "i3", classId: "c1", parentId: "f1", kind: "file", name: "semaine 1.pdf", visibility: ["guardian"], file: file("file4", "semaine 1.pdf"), updatedAt: "2026-11-18T10:00:00Z" }]
          : [folder],
      }),
  });
  await page.goto("/fr/classes/c1/drive?folder=f1");

  await expect(page.getByRole("heading", { level: 1, name: "Espace de la classe" })).toBeVisible();
  await expect(page.getByText("semaine 1.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aperçu de semaine 1.pdf" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Envoyer/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Supprimer/ })).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});
