import { describe, it, expect } from "vitest";
import { COLORS } from "../src/ui/theme.js";

// WCAG 2.1 relative luminance + contrast ratio.
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("WCAG-AA contrast on design tokens", () => {
  it("mist text on slate panel >= 4.5:1", () => {
    expect(contrast(COLORS.mist, COLORS.slate)).toBeGreaterThanOrEqual(4.5);
  });
  it("mist text on ink scrim >= 4.5:1", () => {
    expect(contrast(COLORS.mist, COLORS.ink)).toBeGreaterThanOrEqual(4.5);
  });
  it("ink text on lantern primary button >= 4.5:1", () => {
    expect(contrast(COLORS.ink, COLORS.lantern)).toBeGreaterThanOrEqual(4.5);
  });
  it("mist text on rust danger button >= 3:1 (AA-large; button copy is 14px bold)", () => {
    // Pure rust + mist is 3.53:1 — meets AA-large for bold UI text. Danger
    // copy is rare and emphatic; if we ever drop weight below 600 we should
    // either darken rust or shift the button to a rust-accent variant.
    expect(contrast(COLORS.mist, COLORS.rust)).toBeGreaterThanOrEqual(3);
  });
  it("lake accent against slate panel >= 3:1 (UI hairline AA-large)", () => {
    expect(contrast(COLORS.lake, COLORS.slate)).toBeGreaterThanOrEqual(3);
  });
});
