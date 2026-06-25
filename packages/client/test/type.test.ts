import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TYPE_CSS = resolve(__dirname, "..", "src", "ui", "type.css");

let css = "";
beforeAll(async () => {
  css = await readFile(TYPE_CSS, "utf8");
});

describe("typography (type.css)", () => {
  it("self-hosts via Fontsource — no external CDN reference", () => {
    expect(css).toContain("@fontsource/bricolage-grotesque");
    expect(css).toContain("@fontsource/hanken-grotesk");
    expect(css).toContain("@fontsource/spline-sans-mono");
    expect(css).not.toMatch(/fonts\.googleapis\.com/);
    expect(css).not.toMatch(/use\.typekit\.net/);
    expect(css).not.toMatch(/cdn\.fontsource\.org/);
  });

  it("binds tabular figures on .t-num / .t-mono", () => {
    expect(css).toMatch(/tabular-nums/);
    expect(css).toMatch(/"tnum"\s*1/);
  });

  it("declares all three families as CSS vars", () => {
    expect(css).toMatch(/--font-display:/);
    expect(css).toMatch(/--font-body:/);
    expect(css).toMatch(/--font-mono:/);
  });

  it("declares the spec's type scale (display 32/24/20, body 16/14, mono 14/12)", () => {
    expect(css).toContain("--type-display-lg: 32px");
    expect(css).toContain("--type-display-md: 24px");
    expect(css).toContain("--type-display-sm: 20px");
    expect(css).toContain("--type-body-lg: 16px");
    expect(css).toContain("--type-body-sm: 14px");
    expect(css).toContain("--type-mono-lg: 14px");
    expect(css).toContain("--type-mono-sm: 12px");
  });
});
