import { test, expect } from "@playwright/test";

const SCREENS = [
  { id: "landing", testid: "landing" },
  { id: "connect", testid: "connect" },
  { id: "character", testid: "character-screen" },
  { id: "skills", testid: "skills-screen" },
  { id: "inventory", testid: "inventory-screen" },
  { id: "chat", testid: "chat-panel-screen" },
  { id: "combat", testid: "combat-demo" },
  { id: "quests", testid: "quests-screen" },
  { id: "market", testid: "market-screen" },
  { id: "bank", testid: "bank-screen" },
  { id: "friends", testid: "friends-screen" },
  { id: "settings-tabs", testid: "settings-tabs-screen" },
  { id: "loading", testid: "loading-screen" },
] as const;

/** D1 — every screen renders at a phone viewport without horizontal scroll. */
test.describe("D1: phone viewport (375 x 667)", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  for (const s of SCREENS) {
    test(`${s.id} fits the viewport`, async ({ page }) => {
      await page.goto(`/?ui=${s.id}&offline=1`);
      await expect(page.getByTestId(s.testid)).toBeVisible();
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${s.id} should not horizontally overflow`).toBeLessThanOrEqual(2);
    });
  }
});

/** D2 — keyboard reaches a focusable control on each screen + no JS console errors. */
test.describe("D2: a11y and console hygiene", () => {
  for (const s of SCREENS) {
    test(`${s.id} keyboard-reaches a control + clean console`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (/Failed to load resource/i.test(text)) return;
        errors.push(text);
      });

      await page.goto(`/?ui=${s.id}&offline=1`);
      await expect(page.getByTestId(s.testid)).toBeVisible();

      let active = "";
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        active = await page.evaluate(() => document.activeElement?.tagName ?? "");
        if (["BUTTON", "INPUT", "A", "SELECT"].includes(active)) break;
      }
      expect(["BUTTON", "INPUT", "A", "SELECT"], `${s.id} should be keyboard-reachable`).toContain(active);
      expect(errors, `${s.id} console errors`).toEqual([]);
    });
  }
});
