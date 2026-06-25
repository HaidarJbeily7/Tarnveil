import { test, expect } from "@playwright/test";

test("in-world HUD: vitals, hotbar, currency, and minimap render in their regions", async ({ page }) => {
  await page.goto("/?offline=1");
  await expect(page.getByTestId("hud-layout")).toBeVisible();

  await expect(page.getByTestId("hud-hp")).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuemax");

  await expect(page.getByTestId("hud-skills")).toBeVisible();
  await expect(page.getByTestId("hud-skills").locator(".bar")).toHaveCount(5);

  const hotbar = page.getByTestId("hud-hotbar");
  await expect(hotbar).toBeVisible();
  await expect(hotbar.locator(".slot")).toHaveCount(10);
  await expect(hotbar).toHaveAttribute("role", "toolbar");

  // Currency cluster uses tabular figures (.t-num class).
  const gold = page.getByTestId("hud-gold").locator(".hud-currency__value");
  await expect(gold).toBeVisible();
  await expect(gold).toHaveClass(/t-num/);

  await expect(page.getByTestId("hud-zone")).toBeVisible();
  await expect(page.getByTestId("hud-coords")).toBeVisible();
  await expect(page.getByTestId("hud-online")).toBeVisible();
});

test("HUD regions edge-anchor: bottomLeft + topRight", async ({ page }) => {
  await page.goto("/?offline=1");
  await expect(page.getByTestId("hud-layout")).toBeVisible();

  const viewport = page.viewportSize();
  const bottomLeft = await page.locator('[data-region="bottomLeft"]').boundingBox();
  const topRight = await page.locator('[data-region="topRight"]').boundingBox();
  expect(bottomLeft).not.toBeNull();
  expect(topRight).not.toBeNull();
  expect(bottomLeft!.y).toBeGreaterThan(viewport!.height / 2);
  expect(bottomLeft!.x).toBeLessThan(viewport!.width / 2);
  expect(topRight!.y).toBeLessThan(viewport!.height / 2);
  expect(topRight!.x).toBeGreaterThan(viewport!.width / 2);
});
