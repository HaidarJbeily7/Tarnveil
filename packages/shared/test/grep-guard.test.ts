import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

// The forbidden literal — encoded so the guard test itself doesn't trip a future
// stricter scan and is unambiguously the only legitimate occurrence in tree.
const FORBIDDEN = Buffer.from("VGFybnZlaWw=", "base64").toString("utf8");
const SCANNABLE = /\.(ts|tsx|js|mjs|cjs|json|html|md|sql)$/i;
const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".cache", ".vite"]);

async function walk(dir: string, hits: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, hits);
      continue;
    }
    if (!SCANNABLE.test(entry.name)) continue;
    const content = await readFile(full, "utf8");
    if (content.includes(FORBIDDEN)) hits.push(full);
  }
}

describe("R8 grep guard", () => {
  it("no literal game name in client/realtime/api", async () => {
    const hits: string[] = [];
    for (const pkg of ["client", "realtime", "api"]) {
      await walk(resolve(REPO_ROOT, "packages", pkg), hits);
    }
    expect(hits, `Forbidden literal found in: ${hits.join(", ")}`).toEqual([]);
  });

  it("the literal only lives in shared/game.config.ts", async () => {
    const hits: string[] = [];
    await walk(resolve(REPO_ROOT, "packages", "shared"), hits);
    const offenders = hits.filter(
      (p) => !p.endsWith("/game.config.ts") && !p.includes("/test/"),
    );
    expect(offenders, `Forbidden literal in shared outside game.config.ts: ${offenders.join(", ")}`).toEqual(
      [],
    );
  });
});
