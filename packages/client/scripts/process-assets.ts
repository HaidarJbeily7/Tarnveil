#!/usr/bin/env tsx
/**
 * Asset processing — picks a curated set of game-icons SVGs, normalises
 * them so they recolour via `currentColor`, and copies the result into
 * packages/client/public/assets/icons/<kind>.svg.
 *
 * Source SVGs (`fill="#fff"` icon paths against a `<path d="M0 0h512v512H0z"/>`
 * background) are transformed:
 *   1. drop the leading full-canvas black rect
 *   2. replace fill="#fff" with fill="currentColor"
 *
 * Per-icon author + licence (CC-BY 3.0 for game-icons.net) is recorded in
 * ASSETS/ATTRIBUTIONS.md ("Selected icons (recoloured derivatives)" table).
 *
 * Run via: pnpm --filter @tarnveil/client process:assets
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const GAME_ICONS = resolve(REPO_ROOT, "ASSETS", "raw", "game-icons");
const OUT_DIR = resolve(REPO_ROOT, "packages", "client", "public", "assets", "icons");

export interface IconPick {
  /** Slug used as the output filename (and the Icon component key). */
  slug: string;
  /** Path under ASSETS/raw/game-icons/. */
  source: string;
  /** Author of the SVG (the game-icons subfolder). */
  author: string;
}

export const ICONS: ReadonlyArray<IconPick> = [
  { slug: "wood-axe", source: "lorc/wood-axe.svg", author: "Lorc" },
  { slug: "pickaxe", source: "lorc/mining.svg", author: "Lorc" },
  { slug: "fishing-rod", source: "delapouite/fishing-pole.svg", author: "Delapouite" },
  { slug: "cooking-pot", source: "delapouite/cooking-pot.svg", author: "Delapouite" },
  { slug: "wood-pile", source: "delapouite/wood-pile.svg", author: "Delapouite" },
  { slug: "rock", source: "lorc/rock.svg", author: "Lorc" },
  { slug: "shield", source: "willdabeast/round-shield.svg", author: "Willdabeast" },
  { slug: "heart-plus", source: "zeromancer/heart-plus.svg", author: "Zeromancer" },
  { slug: "coins", source: "delapouite/two-coins.svg", author: "Delapouite" },
  { slug: "skills", source: "delapouite/skills.svg", author: "Delapouite" },
];

const BG_RECT = /<path d="M0 0h512v512H0z"\s*\/?>/;

export function normaliseIconSvg(svg: string): string {
  return svg
    .replace(BG_RECT, "")
    .replace(/fill="#fff"/g, 'fill="currentColor"')
    .replace(/fill="#FFFFFF"/g, 'fill="currentColor"');
}

async function run(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const icon of ICONS) {
    const src = resolve(GAME_ICONS, icon.source);
    const raw = await readFile(src, "utf8");
    const out = normaliseIconSvg(raw);
    const dst = resolve(OUT_DIR, `${icon.slug}.svg`);
    await writeFile(dst, out, "utf8");
    console.log(`✓ ${icon.slug}  ← ${icon.source}  (CC-BY ${icon.author})`);
  }
  console.log(`\nWrote ${ICONS.length} icons to ${OUT_DIR}`);
}

// CLI entrypoint guard.
const isMain = process.argv[1] !== undefined && process.argv[1].endsWith("process-assets.ts");
if (isMain) {
  void run().catch((err) => {
    console.error("process-assets failed:", err);
    process.exit(1);
  });
}
