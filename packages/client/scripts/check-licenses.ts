#!/usr/bin/env tsx
/**
 * License check — scans ASSETS/raw/ and verifies every top-level entry
 * (folder or file) has a corresponding row in ASSETS/ATTRIBUTIONS.md.
 *
 * The matching is by the entry's name appearing in the `Path` column of the
 * markdown table. An entry whose row's License column is "CC0" is fine; any
 * other licence requires Author + URL filled in (non-empty, not `—`).
 *
 * Exits 0 when clean, 1 when there are violations.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const RAW_DIR = resolve(REPO_ROOT, "ASSETS", "raw");
const LEDGER = resolve(REPO_ROOT, "ASSETS", "ATTRIBUTIONS.md");

export interface LedgerRow {
  path: string;
  asset: string;
  author: string;
  url: string;
  license: string;
  notes: string;
}

export function parseLedger(md: string): LedgerRow[] {
  const lines = md.split("\n");
  const rows: LedgerRow[] = [];
  let inTable = false;
  for (const line of lines) {
    if (!inTable) {
      if (/^\|\s*Path\s*\|/i.test(line)) inTable = true;
      continue;
    }
    if (!line.startsWith("|")) {
      inTable = false;
      continue;
    }
    // skip separator row
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const [path, asset, author, url, license, notes] = cells as [
      string,
      string,
      string,
      string,
      string,
      string?,
    ];
    if (path.startsWith("_") || path === "") continue;
    rows.push({
      path,
      asset: asset ?? "",
      author: author ?? "",
      url: url ?? "",
      license: license ?? "",
      notes: notes ?? "",
    });
  }
  return rows;
}

export interface CheckResult {
  ok: boolean;
  errors: string[];
  rawEntries: string[];
}

export async function check(): Promise<CheckResult> {
  let entries: string[] = [];
  try {
    entries = (await readdir(RAW_DIR, { withFileTypes: true }))
      .filter((e) => !e.name.startsWith(".") && e.name !== "README.md")
      .map((e) => e.name);
  } catch {
    // No ASSETS/raw yet → treat as empty.
    return { ok: true, errors: [], rawEntries: [] };
  }
  let ledger: LedgerRow[] = [];
  try {
    ledger = parseLedger(await readFile(LEDGER, "utf8"));
  } catch {
    return { ok: false, errors: ["missing ATTRIBUTIONS.md"], rawEntries: entries };
  }
  const errors: string[] = [];
  for (const entry of entries) {
    const match = ledger.find((r) => r.path === entry);
    if (match === undefined) {
      errors.push(`ASSETS/raw/${entry}: no row in ATTRIBUTIONS.md (add an entry under the Path column)`);
      continue;
    }
    if (match.license === "") {
      errors.push(`ASSETS/raw/${entry}: License column is empty in ATTRIBUTIONS.md`);
      continue;
    }
    // Non-CC0 rows must have Author + URL.
    if (match.license.toUpperCase() !== "CC0") {
      if (match.author === "" || match.author === "—") {
        errors.push(`ASSETS/raw/${entry}: ${match.license} requires Author in ATTRIBUTIONS.md`);
      }
      if (match.url === "" || match.url === "—") {
        errors.push(`ASSETS/raw/${entry}: ${match.license} requires Source URL in ATTRIBUTIONS.md`);
      }
    }
  }
  return { ok: errors.length === 0, errors, rawEntries: entries };
}

// CLI entrypoint — only when run directly, not when imported by tests.
async function isMain(): Promise<boolean> {
  try {
    const real = await stat(__filename);
    const arg = process.argv[1];
    if (arg === undefined) return false;
    const argStat = await stat(arg);
    return real.ino === argStat.ino;
  } catch {
    return false;
  }
}

if (await isMain()) {
  const result = await check();
  if (!result.ok) {
    for (const e of result.errors) console.error("✗", e);
    process.exit(1);
  }
  console.log(`✓ ${result.rawEntries.length} asset entries verified`);
}
