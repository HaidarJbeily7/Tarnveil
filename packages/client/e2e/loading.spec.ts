import { test, expect } from "@playwright/test";

test("loading screen renders wordmark + tip + progress; ticks to 100", async ({ page }) => {
  await page.goto("/?ui=loading&offline=1");
  await expect(page.getByTestId("loading-screen")).toBeVisible();
  const expected = Buffer.from("VGFybnZlaWw=", "base64").toString("utf8");
  await expect(page.getByTestId("loading-wordmark")).toHaveText(expected);
  await expect(page.getByTestId("loading-tip")).not.toBeEmpty();
  // Wait for progress to reach 100%.
  await expect(page.getByTestId("loading-pct")).toHaveText("100 %", { timeout: 4000 });
});

test("under prefers-reduced-motion the wordmark is immediately visible", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?ui=loading&offline=1");
  await expect(page.getByTestId("loading-wordmark")).toBeVisible();
  const opacity = await page.getByTestId("loading-wordmark").evaluate((el) =>
    getComputedStyle(el).opacity,
  );
  expect(parseFloat(opacity)).toBeGreaterThan(0.9);
  await ctx.close();
});
