import { test, expect } from "@playwright/test";

test("combat feedback: progress ring, HP pips, floaters, death screen", async ({ page }) => {
  await page.goto("/?ui=combat&offline=1");
  await expect(page.getByTestId("combat-demo")).toBeVisible();

  // Progress ring starts at 0% and runs to complete.
  await expect(page.getByTestId("combat-ring-label")).toHaveText("0%");
  await page.getByRole("button", { name: "Start gather (2s)" }).click();
  await expect(page.getByTestId("combat-ring-label")).toHaveText("✓", { timeout: 4000 });

  // Mob HP pips: hit twice, HP drops by 4.
  await expect(page.getByTestId("combat-mob-hp")).toHaveText("8 / 8");
  await page.getByRole("button", { name: "Hit (-2)" }).click();
  await page.getByRole("button", { name: "Hit (-2)" }).click();
  await expect(page.getByTestId("combat-mob-hp")).toHaveText("4 / 8");

  // Let earlier "-2" damage floaters expire before checking the pickup line.
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Pickup +1 wood" }).click();
  await expect(
    page.getByTestId("combat-stage").locator(".combat-float", { hasText: "+1 wood" }),
  ).toBeVisible();

  // Death screen opens and offers respawn.
  await page.getByRole("button", { name: "Open death screen" }).click();
  await expect(page.getByTestId("combat-death")).toBeVisible();
  await expect(page.getByText("You died")).toBeVisible();
  await page.getByRole("button", { name: "Respawn" }).click();
  await expect(page.getByTestId("combat-death")).toHaveCount(0);
});
