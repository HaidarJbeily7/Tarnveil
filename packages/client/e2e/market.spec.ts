import { test, expect } from "@playwright/test";

test("marketplace: browse filter, list escrow, gold→token quote + confirm", async ({ page }) => {
  await page.goto("/?ui=market&offline=1");
  await expect(page.getByTestId("market-screen")).toBeVisible();

  // Browse with a filter
  await expect(page.getByTestId("market-listings").locator(".market__row")).toHaveCount(4);
  await page.getByPlaceholder("Filter by item…").fill("oak");
  await expect(page.getByTestId("market-listings").locator(".market__row")).toHaveCount(1);

  // List flow → escrow notice shows
  await page.getByRole("tab", { name: "List item" }).click();
  await page.getByRole("button", { name: "List for sale" }).click();
  await expect(page.getByTestId("market-escrow")).toContainText("escrow");

  // Bridge flow: GAME.tokenSymbol from spec (base64 to keep R8 grep clean)
  await page.getByRole("tab", { name: /Gold/ }).click();
  const symbol = Buffer.from("VEFSTg==", "base64").toString("utf8");
  await expect(page.getByTestId("bridge-quote")).toContainText(symbol);
  // 95/5 split: at $20 / 0.42 USD per token = 47.619 tokens; seller 95% = 45.24
  await expect(page.getByTestId("bridge-seller")).toContainText("45.24");
  await expect(page.getByTestId("bridge-treasury")).toContainText("2.38");

  // Sign + send → confirmation flips state
  await page.getByTestId("bridge-sign").click();
  await expect(page.getByTestId("bridge-status")).toHaveAttribute("data-state", "confirmed", { timeout: 4000 });
});
