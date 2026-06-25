import { test, expect } from "@playwright/test";

test("chat panel: tabs, rate-limit feedback, mute hides a sender", async ({ page }) => {
  // 404 for /api/chat is expected in offline mode; we don't enforce no errors here.
  await page.goto("/?ui=chat&offline=1");
  await expect(page.getByTestId("chat-panel-screen")).toBeVisible();

  const tabs = page.getByTestId("chat-tabs");
  await expect(tabs.getByRole("tab")).toHaveCount(3);

  // Switch to Local, send 6 messages — the 6th trips the rate limiter.
  await tabs.getByRole("tab", { name: "Local" }).click();
  const input = page.getByTestId("chat-input");
  for (let i = 0; i < 5; i++) {
    await input.fill(`msg ${i}`);
    await input.press("Enter");
  }
  await input.fill("one too many");
  await input.press("Enter");
  await expect(page.getByTestId("chat-rate-notice")).toBeVisible();

  // Switch to DMs — the alice DM has a "ping" from alice. Mute it.
  await tabs.getByRole("tab", { name: "DMs" }).click();
  await expect(page.getByTestId("chat-feed")).toContainText("alice");
  await page.getByRole("button", { name: "Mute selected sender" }).click();
  await expect(page.getByTestId("chat-feed")).not.toContainText("ping");
});
