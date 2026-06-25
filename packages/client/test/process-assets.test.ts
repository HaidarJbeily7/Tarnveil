import { describe, it, expect } from "vitest";
import { normaliseIconSvg, ICONS } from "../scripts/process-assets.js";

describe("process-assets normaliser", () => {
  it("drops the leading full-canvas rect and recolours to currentColor", () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 0h512v512H0z"/><path fill="#fff" d="M10 10"/></svg>`;
    const out = normaliseIconSvg(input);
    expect(out).not.toContain('d="M0 0h512v512H0z"');
    expect(out).toContain('fill="currentColor"');
    expect(out).not.toContain('fill="#fff"');
  });

  it("ICONS covers the 10 curated slugs", () => {
    const slugs = ICONS.map((i) => i.slug);
    for (const wanted of [
      "wood-axe",
      "pickaxe",
      "fishing-rod",
      "wood-pile",
      "rock",
      "coins",
      "skills",
    ]) {
      expect(slugs).toContain(wanted);
    }
    expect(ICONS).toHaveLength(10);
  });
});
