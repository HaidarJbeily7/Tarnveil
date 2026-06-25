import { test, expect } from "@playwright/test";

test("in-world HUD: vitals, hotbar, currency, and minimap render", async ({ page }) => {
  await page.goto("/?offline=1");
  await expect(page.getByTestId("ingame-hud")).toBeVisible();

  await expect(page.getByTestId("hud-hp")).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuemax");

  await expect(page.getByTestId("hud-skills")).toBeVisible();
  // 5 skill bars
  await expect(page.getByTestId("hud-skills").locator(".bar")).toHaveCount(5);

  const hotbar = page.getByTestId("hud-hotbar");
  await expect(hotbar).toBeVisible();
  await expect(hotbar.locator(".slot")).toHaveCount(10);
  await expect(hotbar).toHaveAttribute("role", "toolbar");

  // Currency cluster uses tabular figures (.t-num class drives font-variant-numeric).
  const gold = page.getByTestId("hud-gold").locator(".ingame-hud__currency-value");
  await expect(gold).toBeVisible();
  await expect(gold).toHaveClass(/t-num/);

  // Minimap and coords
  await expect(page.getByTestId("hud-zone")).toBeVisible();
  await expect(page.getByTestId("hud-coords")).toBeVisible();
  await expect(page.getByTestId("hud-online")).toBeVisible();
});

test("HUD edge-anchors; vitals stay bottom-left, minimap stays top-right", async ({ page }) => {
  await page.goto("/?offline=1");
  await expect(page.getByTestId("ingame-hud")).toBeVisible();

  const viewport = page.viewportSize();
  const vitals = await page.locator(".ingame-hud__vitals").boundingBox();
  const minimap = await page.locator(".ingame-hud__minimap").boundingBox();
  expect(vitals).not.toBeNull();
  expect(minimap).not.toBeNull();

  // Vitals lives in the lower half + left half
  expect(vitals!.y).toBeGreaterThan(viewport!.height / 2);
  expect(vitals!.x).toBeLessThan(viewport!.width / 2);
  // Minimap lives in the upper half + right half
  expect(minimap!.y).toBeLessThan(viewport!.height / 2);
  expect(minimap!.x).toBeGreaterThan(viewport!.width / 2);
});
