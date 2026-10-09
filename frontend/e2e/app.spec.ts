import { expect, test, type Page } from "@playwright/test";

const password = "supersecret1";

async function register(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
}

test("register, create a document and export a PDF", async ({ page }) => {
  await register(page, `e2e_${Date.now()}@example.com`);

  await page.getByRole("button", { name: "New document" }).first().click();
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+/);

  const title = page.getByLabel("Document title");
  await expect(title).toBeVisible();
  await title.fill("E2E Report");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});

test("create a document from a template", async ({ page }) => {
  await register(page, `e2e_${Date.now()}@example.com`);

  await page.getByRole("link", { name: "Templates" }).click();
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();

  await page.getByRole("button", { name: "Use template" }).first().click();
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+/);
  await expect(page.getByLabel("Document title")).toBeVisible();
});
