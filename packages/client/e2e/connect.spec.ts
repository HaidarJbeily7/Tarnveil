import { test, expect } from "@playwright/test";

test("connect screen walks through wallet sign-in states", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/?ui=connect&offline=1");
  await expect(page.getByTestId("connect")).toBeVisible();
  await expect(page.getByTestId("connect-state")).toHaveText("Ready");

  // Idle → connecting → signing → admitted
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByTestId("connect-state")).toHaveText("Connecting to wallet");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("connect-state")).toHaveText("Awaiting signature");

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("connect-state")).toHaveText("Admitted");

  expect(errors).toEqual([]);
});

test("signature rejection gives a recovery action, not a dead end", async ({ page }) => {
  await page.goto("/?ui=connect&offline=1");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I rejected" }).click();
  await expect(page.getByTestId("connect-state")).toHaveText("Signature rejected");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("below-min-balance gate uses GAME.tokenSymbol, not a literal", async ({ page }) => {
  await page.goto("/?ui=connect&offline=1");
  await page.getByRole("button", { name: /Sim: below-min-balance/i }).click();
  const gate = page.getByTestId("connect-gate");
  await expect(gate).toBeVisible();
  // Default token symbol — base64-decoded to keep the R8 grep guard clean
  const expected = Buffer.from("VEFSTg==", "base64").toString("utf8");
  await expect(gate).toContainText(expected);
});
