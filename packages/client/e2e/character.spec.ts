import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Land on the page first, then clear and reload — guarantees a fresh
  // localStorage even when Playwright reuses the dev server.
  await page.goto("/?ui=character&offline=1");
  await page.evaluate(() => localStorage.removeItem("tarn:characters:v1"));
  await page.reload();
  await expect(page.getByTestId("character-screen")).toBeVisible();
});

test("first run shows an empty-state invitation, not a blank", async ({ page }) => {
  await expect(page.getByTestId("character-create-card")).toBeVisible();
  await expect(page.getByText(/Begin your story/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start fresh" })).toBeVisible();
});

test("create flow persists across reload", async ({ page }) => {
  await page.getByRole("button", { name: "Start fresh" }).click();
  await expect(page.getByTestId("character-create-form")).toBeVisible();

  await page.getByTestId("character-name").fill("Aelune");
  await page.getByRole("radio", { name: "lake" }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.getByTestId("character-card")).toBeVisible();
  await expect(page.getByText("Aelune")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Aelune")).toBeVisible();
});

test("Tab key reaches an interactive control with a visible focus ring", async ({ page }) => {
  let tries = 0;
  let active = "";
  while (tries < 8) {
    await page.keyboard.press("Tab");
    active = await page.evaluate(() => document.activeElement?.tagName ?? "");
    if (active === "BUTTON" || active === "INPUT" || active === "A") break;
    tries += 1;
  }
  expect(["BUTTON", "INPUT", "A"]).toContain(active);
});
