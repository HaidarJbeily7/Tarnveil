import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, SPACING, RADIUS, Z, HAIRLINE, cssVar } from "../src/ui/theme.js";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME_CSS = resolve(__dirname, "..", "src", "ui", "theme.css");

describe("design tokens (theme.ts)", () => {
  it("exports the six core colours from FRONTEND_SPEC", () => {
    for (const k of ["ink", "slate", "mist", "lake", "lantern", "rust"] as const) {
      expect(COLORS[k], `${k} should be a #xxxxxx hex`).toMatch(HEX_RE);
    }
  });

  it("exports the two muted supports (reed, brass)", () => {
    expect(COLORS.reed).toMatch(HEX_RE);
    expect(COLORS.brass).toMatch(HEX_RE);
  });

  it("8 px spacing scale exists with named keys", () => {
    expect(SPACING[2]).toBe("8px");
    expect(SPACING[4]).toBe("16px");
    expect(SPACING[8]).toBe("32px");
  });

  it("radius scale includes the spec's md=6px default", () => {
    expect(RADIUS.md).toBe("6px");
    expect(RADIUS.sm).toBe("4px");
    expect(RADIUS.lg).toBe("12px");
  });

  it("z-index layers stack world < hud < panels < modals < toasts", () => {
    expect(Z.world).toBeLessThan(Z.hud);
    expect(Z.hud).toBeLessThan(Z.panels);
    expect(Z.panels).toBeLessThan(Z.modals);
    expect(Z.modals).toBeLessThan(Z.toasts);
  });

  it("hairline is mist at 12% opacity", () => {
    expect(HAIRLINE).toBe("rgba(220, 230, 228, 0.12)");
  });

  it("cssVar resolves to var(--token)", () => {
    expect(cssVar("ink")).toBe("var(--ink)");
    expect(cssVar("hairline")).toBe("var(--hairline)");
  });
});

describe("theme.css mirrors theme.ts", () => {
  it("declares every colour token as a CSS custom property", async () => {
    const css = await readFile(THEME_CSS, "utf8");
    for (const k of Object.keys(COLORS)) {
      expect(css, `--${k} should be declared in theme.css`).toContain(`--${k}:`);
    }
  });

  it("respects prefers-reduced-motion", async () => {
    const css = await readFile(THEME_CSS, "utf8");
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
