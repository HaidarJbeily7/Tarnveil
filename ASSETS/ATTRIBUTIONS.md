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

## Ledger

| Path | Asset | Author | Source URL | License | Notes |
|---|---|---|---|---|---|
| _(empty — no assets pulled yet)_ | | | | | |
