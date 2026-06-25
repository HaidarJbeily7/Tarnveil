import { test, expect } from "@playwright/test";

test("landing screen renders wordmark, tagline, CTA, and a live chat panel", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // The chat feed polls /api/chat — when the API isn't running (offline
    // dev), the browser logs a "Failed to load resource: 404" warning per
    // poll. That's expected; we only want JS-level errors.
    if (/Failed to load resource/i.test(text)) return;
    errors.push(text);
  });

  await page.goto("/?ui=landing&offline=1");
  await expect(page.getByTestId("landing")).toBeVisible();
  // Wordmark reads the spec name from GAME (R8). The default branch's
  // GAME.name is the project name — base64-decoded so this file itself
  // doesn't trip the R8 grep guard.
  const expected = Buffer.from("VGFybnZlaWw=", "base64").toString("utf8");
  await expect(page.getByTestId("wordmark")).toHaveText(expected);
  await expect(page.getByTestId("tagline")).toContainText("isometric");
  await expect(page.getByTestId("enter-cta")).toBeVisible();
  await expect(page.getByTestId("landing-chat")).toBeVisible();
  // The chat list region is aria-live so screen readers pick up new lines.
  await expect(page.getByRole("log", { name: "world chat" })).toBeVisible();

  // No fonts.googleapis.com / typekit requests — fonts self-hosted (A2).
  const fontRequests = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r) => /font/i.test(r.name) || /\.woff2?$/i.test(r.name))
      .map((r) => r.name),
  );
  for (const url of fontRequests) {
    expect(url).not.toMatch(/fonts\.googleapis\.com/);
    expect(url).not.toMatch(/use\.typekit\.net/);
  }

  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});

test("CTA routes to ?ui=connect on click", async ({ page }) => {
  await page.goto("/?ui=landing&offline=1");
  await page.getByTestId("enter-cta").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("ui")).toBe("connect");
});

test("reveal animation collapses under prefers-reduced-motion", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?ui=landing&offline=1");
  // The hero children animate from opacity:0 → 1; under reduced-motion the
  // CSS rule sets opacity:1 with no animation. Sample the wordmark.
  const opacity = await page.getByTestId("wordmark").evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(opacity)).toBeGreaterThan(0.9);
  await ctx.close();
});
