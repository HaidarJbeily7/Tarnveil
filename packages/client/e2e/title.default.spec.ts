import { test, expect } from "@playwright/test";

const DEFAULT_NAME = Buffer.from("VGFybnZlaWw=", "base64").toString("utf8");

test("loads with no console errors and tab title equals GAME.name (default)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await expect(page).toHaveTitle(DEFAULT_NAME);
  // Splash text on the Phaser canvas can't be DOM-asserted; the canvas existing
  // (and no console errors) is the proxy for "Phaser booted".
  await expect(page.locator("#game canvas")).toBeVisible();
  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});
