import { test, expect } from "@playwright/test";

test("toasts stack without overlap, live-announce, and auto-dismiss", async ({ page }) => {
  await page.goto("/?ui=gallery&offline=1");

  // Push three toasts; each is rendered into the same aria-live region.
  await page.getByRole("button", { name: "Info toast" }).click();
  await page.getByRole("button", { name: "Success" }).click();
  await page.getByRole("button", { name: "Danger" }).click();

  const stack = page.getByRole("region", { name: "notifications" });
  await expect(stack).toBeVisible();
  await expect(stack).toHaveAttribute("aria-live", "polite");

  // All three present.
  await expect(stack.locator(".toast")).toHaveCount(3);

  // Their bounding rects don't overlap (vertical stack).
  const rects = await stack.locator(".toast").evaluateAll((els) =>
    (els as HTMLElement[]).map((el) => el.getBoundingClientRect()).map((r) => ({
      top: r.top,
      bottom: r.bottom,
    })),
  );
  for (let i = 0; i + 1 < rects.length; i++) {
    expect(rects[i]!.bottom).toBeLessThanOrEqual(rects[i + 1]!.top + 1);
  }

  // Auto-dismiss after the default duration (4 s).
  await expect(stack.locator(".toast")).toHaveCount(0, { timeout: 6000 });
});

test("reduced-motion: toast transition collapses", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?ui=gallery&offline=1");
  await page.getByRole("button", { name: "Info toast" }).click();
  const toast = page.locator(".toast").first();
  await expect(toast).toBeVisible();
  const dur = await toast.evaluate((el) => getComputedStyle(el).transitionDuration);
  for (const piece of dur.split(",")) {
    const num = parseFloat(piece.trim());
    const isSeconds = piece.includes("s") && !piece.includes("ms");
    const ms = isSeconds ? num * 1000 : num;
    expect(ms).toBeLessThan(20);
  }
  await ctx.close();
});
