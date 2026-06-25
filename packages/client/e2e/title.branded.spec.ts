import { test, expect } from "@playwright/test";

test("tab title follows GAME_NAME env override", async ({ page }) => {
  await page.goto("/?offline=1");
  await expect(page).toHaveTitle("Foo");
});
