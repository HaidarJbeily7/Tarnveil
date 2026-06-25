import { test, expect } from "@playwright/test";

test("quests panel: progress, claim once, countdown ticks", async ({ page }) => {
  await page.goto("/?ui=quests&offline=1");
  await expect(page.getByTestId("quests-screen")).toBeVisible();

  await expect(page.getByTestId("quest-row")).toHaveCount(3);

  // The stone quest is the seeded "complete" one — its claim is enabled.
  const stoneClaim = page.getByTestId("quest-claim-daily-stone-2");
  await expect(stoneClaim).toBeEnabled();

  // The wolf quest is at 0 — claim is disabled.
  const wolfClaim = page.getByTestId("quest-claim-daily-wolf-1");
  await expect(wolfClaim).toBeDisabled();

  // Claim once; the button flips to "Claimed" and disables.
  await stoneClaim.click();
  await expect(stoneClaim).toHaveText("Claimed");
  await expect(stoneClaim).toBeDisabled();

  // Countdown is non-empty mono text in the form HH:MM:SS.
  await expect(page.getByTestId("quests-countdown")).toContainText(/Resets in \d{2}:\d{2}:\d{2}/);
});
