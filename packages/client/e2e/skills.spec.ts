import { test, expect } from "@playwright/test";

test("skills panel shows five skills with bars; level never exceeds 20", async ({ page }) => {
  await page.goto("/?ui=skills&offline=1");
  await expect(page.getByTestId("skills-screen")).toBeVisible();
  await expect(page.getByTestId("skill-row")).toHaveCount(5);
  // Each row carries a bar and a level marker.
  await expect(page.getByTestId("skills-list").locator(".bar__track")).toHaveCount(5);
  // No level above 20 anywhere on screen.
  const text = await page.getByTestId("skills-list").innerText();
  const levels = Array.from(text.matchAll(/Level (\d+)/g)).map((m) => Number(m[1]));
  for (const lvl of levels) expect(lvl).toBeLessThanOrEqual(20);
});
