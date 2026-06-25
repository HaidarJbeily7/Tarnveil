import { test, expect } from "@playwright/test";

test("component gallery renders every primitive", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/?ui=gallery&offline=1");
  await expect(page.getByTestId("gallery")).toBeVisible();

  // At least one of each component
  await expect(page.locator(".panel").first()).toBeVisible();
  await expect(page.locator(".btn--primary").first()).toBeVisible();
  await expect(page.locator(".btn--secondary").first()).toBeVisible();
  await expect(page.locator(".btn--danger").first()).toBeVisible();
  await expect(page.locator('.tabs__tab[aria-selected="true"]').first()).toBeVisible();
  await expect(page.locator(".slot").first()).toBeVisible();
  await expect(page.locator(".bar__track").first()).toBeVisible();

  // Tabbing reaches an interactive element with a visible focus outline.
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(focused === "BUTTON" || focused === "A").toBe(true);

  // Trigger a toast and confirm it lands in the live region.
  await page.getByRole("button", { name: "Info toast" }).click();
  await expect(page.locator(".toast").first()).toBeVisible();

  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});

test("gallery respects prefers-reduced-motion (no transition durations)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?ui=gallery&offline=1");
  await expect(page.getByTestId("gallery")).toBeVisible();
  // The theme.css media query collapses every animation/transition duration
  // to ~0ms under reduced motion. Sample a button: its computed transition
  // duration should be essentially zero.
  const dur = await page.locator(".btn").first().evaluate((el) =>
    getComputedStyle(el).transitionDuration,
  );
  // The duration may come back as a comma-separated list (one entry per
  // transitioned property). Every entry should be ~0s.
  for (const piece of dur.split(",")) {
    const num = parseFloat(piece.trim());
    const isSeconds = piece.includes("s") && !piece.includes("ms");
    const ms = isSeconds ? num * 1000 : num;
    expect(ms, `reduced-motion duration piece ${piece} should be ~0ms`).toBeLessThan(20);
  }
  await ctx.close();
});
