import { test, expect, type Page } from "@playwright/test";

/**
 * G3 — keyboard movement (WASD + arrow keys). The world step delta is
 * screen-aligned: pressing "up" moves the avatar visually upward, which
 * on the iso grid means col-1, row-1. Same direction logic mirrored for
 * the other three.
 */

type Dir = "up" | "down" | "left" | "right";

async function tile(page: Page): Promise<{ col: number; row: number }> {
  return page.evaluate(() => {
    const w = window as unknown as { __tarn: { getAvatarTile(): { col: number; row: number } } };
    return w.__tarn.getAvatarTile();
  });
}
async function park(page: Page, col: number, row: number): Promise<void> {
  await page.evaluate(({ c, r }) => {
    const w = window as unknown as { __tarn: { setAvatarTile(t: { col: number; row: number }): void } };
    w.__tarn.setAvatarTile({ col: c, row: r });
  }, { c: col, r: row });
}
async function step(page: Page, dir: Dir): Promise<"ok" | "blocked" | "moving"> {
  return page.evaluate(
    (d) => {
      const w = window as unknown as { __tarn: { keyboardStep(d2: Dir): "ok" | "blocked" | "moving" } };
      return w.__tarn.keyboardStep(d);
    },
    dir,
  );
}
async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as unknown as { __tarn?: { keyboardStep?: unknown } };
    return Boolean(w.__tarn?.keyboardStep);
  });
}

test("keyboard step API moves the avatar in screen-aligned directions", async ({ page }) => {
  await page.goto("/?offline=1");
  await ready(page);

  // Park the avatar in the middle so all four directions are unblocked.
  await park(page, 4, 4);
  expect(await tile(page)).toEqual({ col: 4, row: 4 });

  // up = NW on the iso grid (both col-1 and row-1).
  expect(await step(page, "up")).toBe("ok");
  await page.waitForTimeout(260); // STEP_MS=180 + a margin
  expect(await tile(page)).toEqual({ col: 3, row: 3 });

  expect(await step(page, "right")).toBe("ok");
  await page.waitForTimeout(260);
  expect(await tile(page)).toEqual({ col: 4, row: 2 });

  expect(await step(page, "down")).toBe("ok");
  await page.waitForTimeout(260);
  expect(await tile(page)).toEqual({ col: 5, row: 3 });

  expect(await step(page, "left")).toBe("ok");
  await page.waitForTimeout(260);
  expect(await tile(page)).toEqual({ col: 4, row: 4 });
});

test("keyboard step refuses out-of-bounds tiles", async ({ page }) => {
  await page.goto("/?offline=1");
  await ready(page);

  await park(page, 0, 0);
  expect(await step(page, "up")).toBe("blocked");
  expect(await tile(page)).toEqual({ col: 0, row: 0 });
});

test("pressing W with the canvas focused walks one tile up", async ({ page }) => {
  await page.goto("/?offline=1");
  await ready(page);
  await park(page, 5, 4);

  // Phaser's keyboard plugin polls Key.isDown on update. A press-and-release
  // that's faster than one Phaser tick can be missed entirely, so hold the
  // key down for a couple of frames before releasing.
  await page.locator("#game").click({ position: { x: 50, y: 50 } });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(80);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(320);
  expect(await tile(page)).toEqual({ col: 4, row: 3 });
});
