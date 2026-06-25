import { test, expect } from "@playwright/test";

interface ChopTestApi {
  getWood(): number;
  attemptChop(): "ok" | "out-of-range";
  setAvatarTile(tile: { col: number; row: number }): void;
  treeTile(): { col: number; row: number };
}

declare global {
  interface Window {
    __tarn?: ChopTestApi;
  }
}

test("in-range chop awards +1 wood; out-of-range chop is a no-op", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__tarn));

  // Avatar starts at (1,1); tree is at (5,5). Distance 4 — out of range.
  expect(await page.evaluate(() => window.__tarn!.getWood())).toBe(0);
  expect(await page.evaluate(() => window.__tarn!.attemptChop())).toBe("out-of-range");
  expect(await page.evaluate(() => window.__tarn!.getWood())).toBe(0);
  await expect(page.locator("#hud-wood")).toHaveText("0");

  // Teleport adjacent to the tree (Chebyshev distance 1) and chop.
  await page.evaluate(() => {
    const t = window.__tarn!.treeTile();
    window.__tarn!.setAvatarTile({ col: t.col - 1, row: t.row });
  });
  expect(await page.evaluate(() => window.__tarn!.attemptChop())).toBe("ok");
  expect(await page.evaluate(() => window.__tarn!.getWood())).toBe(1);
  await expect(page.locator("#hud-wood")).toHaveText("1");
});
