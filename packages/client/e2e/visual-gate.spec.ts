import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * UI_FIX_SPEC F6 — Visual acceptance gate.
 *
 * For every route the gate:
 *   1. Takes a screenshot to artifacts/ui/<route>.png (gitignored — the
 *      spec is the contract; the images are for human review).
 *   2. Asserts the layout invariants:
 *        - no two [data-panel] rects overlap (tooltips/toasts/modals
 *          live on higher z-layers and are explicitly excluded)
 *        - every [data-panel] sits fully inside the viewport
 *        - exactly the expected number of HP bars, currency clusters,
 *          and wordmarks render for the route
 *
 * If this gate fails, the screen looks wrong, not just behaves wrong.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = resolve(__dirname, "..", "..", "..", "artifacts", "ui");

interface RouteSpec {
  id: string;
  url: string;
  /** Element that must be visible before we screenshot. */
  ready: string;
  /** Counts the gate enforces for this route. */
  expect: { wordmark: number; hp: number; gold: number };
}

const ROUTES: ReadonlyArray<RouteSpec> = [
  { id: "landing",       url: "/?ui=landing&offline=1",       ready: '[data-testid="landing"]',             expect: { wordmark: 1, hp: 0, gold: 0 } },
  { id: "connect",       url: "/?ui=connect&offline=1",       ready: '[data-testid="connect"]',             expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "character",     url: "/?ui=character&offline=1",     ready: '[data-testid="character-screen"]',     expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "skills",        url: "/?ui=skills&offline=1",        ready: '[data-testid="skills-screen"]',        expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "inventory",     url: "/?ui=inventory&offline=1",     ready: '[data-testid="inventory-screen"]',     expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "chat",          url: "/?ui=chat&offline=1",          ready: '[data-testid="chat-panel-screen"]',    expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "combat",        url: "/?ui=combat&offline=1",        ready: '[data-testid="combat-demo"]',          expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "quests",        url: "/?ui=quests&offline=1",        ready: '[data-testid="quests-screen"]',        expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "market",        url: "/?ui=market&offline=1",        ready: '[data-testid="market-screen"]',        expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "bank",          url: "/?ui=bank&offline=1",          ready: '[data-testid="bank-screen"]',          expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "friends",       url: "/?ui=friends&offline=1",       ready: '[data-testid="friends-screen"]',       expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "settings-tabs", url: "/?ui=settings-tabs&offline=1", ready: '[data-testid="settings-tabs-screen"]', expect: { wordmark: 0, hp: 0, gold: 0 } },
  { id: "loading",       url: "/?ui=loading&offline=1",       ready: '[data-testid="loading-screen"]',       expect: { wordmark: 1, hp: 0, gold: 0 } },
  { id: "game",          url: "/?offline=1",                  ready: '[data-testid="hud-layout"]',           expect: { wordmark: 0, hp: 1, gold: 1 } },
];

interface Rect { x: number; y: number; width: number; height: number; }

async function collectPanelRects(page: Page): Promise<Array<Rect & { tag: string }>> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-panel]"));
    return els
      .filter((el) => el.offsetParent !== null) // skip hidden
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.getAttribute("data-panel") ?? "",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      });
  });
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

test.describe("F6: visual acceptance gate", () => {
  test.beforeAll(async () => {
    await mkdir(ARTIFACTS, { recursive: true });
  });

  // UI_FIX_2 — review the game route at a phone viewport too. The polish
  // spec only confirms no horizontal overflow; this writes a screenshot
  // we can actually look at.
  test("game (mobile 390x844) renders + screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?offline=1");
    await expect(page.locator('[data-testid="hud-layout"]')).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(ARTIFACTS, "game-mobile.png"), fullPage: false });
    // Singletons still hold at mobile.
    expect(await page.locator('[data-testid="hud-hp"]').count()).toBe(1);
    expect(await page.locator('[data-testid="hud-gold"]').count()).toBe(1);
  });

  for (const route of ROUTES) {
    test(`${route.id} passes layout invariants + screenshots`, async ({ page }) => {
      await page.goto(route.url);
      await expect(page.locator(route.ready)).toBeVisible();
      // Give async content (icon SVG fetches, chat empty state) a moment.
      await page.waitForTimeout(250);

      // --- 1. Screenshot (gitignored; human-review surface) ---
      await page.screenshot({ path: resolve(ARTIFACTS, `${route.id}.png`), fullPage: false });

      // --- 2. No two [data-panel] rects overlap ---
      const rects = await collectPanelRects(page);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          expect(
            overlaps(a, b),
            `panels overlap on ${route.id}: "${a.tag}" and "${b.tag}"`,
          ).toBe(false);
        }
      }

      // --- 3. Every panel inside the viewport ---
      const vp = page.viewportSize();
      for (const r of rects) {
        expect(r.x, `${route.id}: ${r.tag} x out of viewport`).toBeGreaterThanOrEqual(-1);
        expect(r.y, `${route.id}: ${r.tag} y out of viewport`).toBeGreaterThanOrEqual(-1);
        expect(r.x + r.width, `${route.id}: ${r.tag} right out of viewport`).toBeLessThanOrEqual(vp!.width + 1);
        expect(r.y + r.height, `${route.id}: ${r.tag} bottom out of viewport`).toBeLessThanOrEqual(vp!.height + 1);
      }

      // --- 4. Singleton counts ---
      const wordmarks = await page.locator('[data-testid="wordmark"], [data-testid="loading-wordmark"]').count();
      expect(wordmarks, `${route.id}: wordmark count`).toBe(route.expect.wordmark);

      const hpBars = await page.locator('[data-testid="hud-hp"]').count();
      expect(hpBars, `${route.id}: hp bar count`).toBe(route.expect.hp);

      const gold = await page.locator('[data-testid="hud-gold"]').count();
      expect(gold, `${route.id}: currency cluster count`).toBe(route.expect.gold);
    });
  }
});
