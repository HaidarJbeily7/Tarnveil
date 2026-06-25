import { describe, it, expect } from "vitest";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_ROOT = resolve(__dirname, "..", "src", "ui");

// FRONTEND_SPEC A1 grep guard: every UI screen / component file pulls colour
// from theme tokens. Raw "#xxxxxx" or "0xRRGGBB" is allowed ONLY in theme.*
// (and a small carve-out for components/__tests__ stories that intentionally
// document the literal — none yet).
const CSS_HEX = /#[0-9A-Fa-f]{6}\b/;
const PHASER_HEX = /0x[0-9A-Fa-f]{6}\b/;

interface Hit {
  file: string;
  line: number;
  text: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string, hits: Hit[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, hits);
      continue;
    }
    if (!/\.(ts|tsx|css|html)$/.test(e.name)) continue;
    // Theme files own the literals.
    if (/^theme\.(ts|css)$/.test(e.name)) continue;
    const content = await readFile(full, "utf8");
    content.split("\n").forEach((line, i) => {
      if (CSS_HEX.test(line) || PHASER_HEX.test(line)) {
        hits.push({ file: full, line: i + 1, text: line.trim() });
      }
    });
  }
}

describe("UI grep guard — raw colour literals", () => {
  it("no #xxxxxx or 0xRRGGBB outside theme files in src/ui", async () => {
    if (!(await exists(UI_ROOT))) return; // first commit creates the folder
    const hits: Hit[] = [];
    await walk(UI_ROOT, hits);
    const report = hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join("\n");
    expect(hits, report).toEqual([]);
  });
});
