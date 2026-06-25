# Asset attributions ledger

> Every non-CC0 asset that ships in `packages/client/public/assets/` must
> appear in this file before it is committed. CC0 assets may be marked CC0
> in the License column.
>
> **Discipline:**
>
> 1. **Prefer CC0** (public domain, no attribution required).
>    Kenney is the default first stop — see `FRONTEND_SPEC.md` for the
>    sourced list (kenney.nl, game-icons.net, OpenGameArt.org, LPC,
>    Fontsource, Lucide, etc.).
> 2. **CC-BY / CC-BY-SA / OFL / MIT are fine** but each asset (or pack)
>    requires an entry here: author, asset, source URL, license.
> 3. **CC-BY-SA derivatives stay CC-BY-SA.** When you re-colour or remix a
>    CC-BY-SA asset, the output remains share-alike; mark the row with a
>    `(derivative)` note.
> 4. **No ripped or copyrighted assets** from commercial games, films, or
>    brands. If a pack has no clear license file, do not use it.
>
> The license-check script
> (`pnpm --filter @tarnveil/client check:licenses`) scans
> `ASSETS/raw/*` and fails if any directory or top-level file lacks an
> entry below. The same check runs as a vitest spec on every test pass.

## Quick rules

- One row per pack (or per single file if a pack mixes licenses).
- The **Path** column matches the folder or file under `ASSETS/raw/` exactly.
- "CC0" assets list `Author = —` and `URL = —` if attribution is genuinely
  not required (most Kenney packs); we still want to know where it came
  from for provenance.

## npm-installed assets (logged for completeness — not in ASSETS/raw/)

These ship via `node_modules` and are bundled by Vite at build time.
They sit outside the `ASSETS/raw/` scan but are recorded here for the
licence audit (Phase D5).

| Package | License | Use | Notes |
|---|---|---|---|
| `@fontsource/bricolage-grotesque` | OFL 1.1 | Display family (wordmark, titles) | A2 |
| `@fontsource/hanken-grotesk` | OFL 1.1 | Body family (labels, chat) | A2 |
| `@fontsource/spline-sans-mono` | OFL 1.1 | Numeric/utility family (tabular figures) | A2 |
| `lucide` | ISC | Chrome icons (settings, close, arrows) | recolour via currentColor |

## Pending downloads (B2 — manual)

The art-asset pulls below require browser/git access this build host
doesn't have. The recipe and target paths are documented here so the
download is a one-shot for a human or a CI step with network egress.

| Target path | Pack | Source | License | Recipe |
|---|---|---|---|---|
| `ASSETS/raw/kenney-isometric/` | Kenney Isometric Tiles | https://kenney.nl/assets — search "isometric" | CC0 | Download zip, unzip into target path. |
| `ASSETS/raw/kenney-ui/` | Kenney UI Pack | https://kenney.nl/assets/ui-pack | CC0 | Download zip, unzip into target path. |
| `ASSETS/raw/game-icons/` | game-icons.net | `git clone https://github.com/game-icons/icons` | CC-BY 3.0 (Lorc/Delapouite/etc.) | Pick the 5–10 icons we use (axe, pickaxe, fish, wood, stone, hide), copy SVGs into target path; log per-icon authors below. |
| `ASSETS/raw/lpc-player/` | LPC player character sheet | https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator | CC-BY-SA 3.0 / GPL 3.0 | Generate one sheet, save PNG into target path. Re-colours stay CC-BY-SA (derivative). |

When a folder above is populated, add its row to the ledger table below.

## Ledger

| Path | Asset | Author | Source URL | License | Notes |
|---|---|---|---|---|---|
| _(empty — no assets pulled yet)_ | | | | | |
