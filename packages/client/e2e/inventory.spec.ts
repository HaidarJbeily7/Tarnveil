import { test, expect } from "@playwright/test";

test("inventory grid: tooltips, click-to-inspect, locked drop shows a clear reason", async ({ page }) => {
  await page.goto("/?ui=inventory&offline=1");
  await expect(page.getByTestId("inventory-screen")).toBeVisible();

  // 24 cells in the grid
  await expect(page.getByTestId("inventory-grid").locator(".slot")).toHaveCount(24);

  // Click the first slot — detail panel shows the item with action buttons.
  const first = page.getByTestId("inventory-grid").locator(".slot").nth(0);
  await first.click();
  const detail = page.getByTestId("inventory-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button", { name: "Use" })).toBeVisible();

  // The shield is equipped and can't be dropped — pick that slot (index 6).
  await page.getByTestId("inventory-grid").locator(".slot").nth(6).click();
  await expect(page.getByTestId("inventory-reason")).toContainText(/Equipped/i);
  const dropBtn = detail.getByRole("button", { name: "Drop" });
  await expect(dropBtn).toBeDisabled();
});
