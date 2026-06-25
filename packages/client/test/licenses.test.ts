import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, parseLedger } from "../scripts/check-licenses.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER = resolve(__dirname, "..", "..", "..", "ASSETS", "ATTRIBUTIONS.md");

describe("asset attribution ledger", () => {
  it("ATTRIBUTIONS.md states the CC0-preferred rule", async () => {
    const md = await readFile(LEDGER, "utf8");
    expect(md).toMatch(/Prefer CC0/i);
    expect(md).toMatch(/every non-CC0 asset/i);
  });

  it("ATTRIBUTIONS.md has the table header row", async () => {
    const md = await readFile(LEDGER, "utf8");
    expect(md).toMatch(/\|\s*Path\s*\|\s*Asset\s*\|\s*Author\s*\|\s*Source URL\s*\|\s*License\s*\|/);
  });

  it("parser tolerates the empty placeholder row", async () => {
    const md = await readFile(LEDGER, "utf8");
    const rows = parseLedger(md);
    expect(rows).toEqual([]);
  });

  it("license check returns ok against the current asset tree", async () => {
    const result = await check();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
