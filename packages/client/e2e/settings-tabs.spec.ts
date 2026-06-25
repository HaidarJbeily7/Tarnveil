import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?ui=settings-tabs&offline=1");
  await page.evaluate(() => localStorage.removeItem("tarn:settings-tabs:v1"));
  await page.reload();
  await expect(page.getByTestId("settings-tabs-screen")).toBeVisible();
});

test("four tabs render; defaults visible on Audio", async ({ page }) => {
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab")).toHaveCount(4);
  await expect(page.getByText("Master volume")).toBeVisible();
});

test("toggling reduced-motion + colorblind palette persists across reload", async ({ page }) => {
  await page.getByRole("tab", { name: "Accessibility" }).click();
  await page.getByTestId("settings-reduce-motion").check();
  await page.getByTestId("settings-palette").check();
  // Palette applied immediately: html[data-palette="cb"]
  await expect(page.locator("html")).toHaveAttribute("data-palette", "cb");

  // Reload — settings persist
  await page.reload();
  await page.getByRole("tab", { name: "Accessibility" }).click();
  await expect(page.getByTestId("settings-reduce-motion")).toBeChecked();
  await expect(page.getByTestId("settings-palette")).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "cb");
});
