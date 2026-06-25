import { test, expect } from "@playwright/test";

test("friends: list, presence dot, accept request, open DM", async ({ page }) => {
  await page.goto("/?ui=friends&offline=1");
  await expect(page.getByTestId("friends-screen")).toBeVisible();

  // 4 friends on the list to start
  await expect(page.getByTestId("friend-row")).toHaveCount(4);

  // First friend is "online" — dot has presence=online
  await expect(page.getByTestId("friends-list").locator(".friends__dot").first()).toHaveAttribute("data-presence", "online");

  // Pending request "Eril" — accept it; he joins the list (5 rows)
  await expect(page.getByTestId("friends-pending")).toContainText("Eril");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("friend-row")).toHaveCount(5);

  // Open DM with Aelune → router flips ?ui=chat
  await page.locator('[data-testid^="friend-dm-"]').first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("ui")).toBe("chat");
});
