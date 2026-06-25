# FRONTEND_SPEC — Tarnveil UI, Visual Identity & Asset Sourcing

> **For Claude Code.** The game logic from `BUILD_SPEC.md` is built. This spec covers the
> **UI/frontend polish** and **where to pull assets** (sprites, tiles, icons, fonts, audio).
> Same execution rules as before: do **one TASK at a time**, run its **Verify**, commit with
> the given message, and honor the **Global Rules** (especially **R8** — the game name comes
> from `GAME` config, never a literal). All branding here derives from `packages/shared/game.config.ts`.

---

## HOW TO USE THIS FILE

1. Do **Phase A (design system)** and **Phase B (asset pipeline)** first — every screen
   depends on them.
2. Then build screens in **Phase C** in order. Each TASK: **Goal → Steps → Files → Verify →
   Commit**. The Verify line is the definition of done; prefer the automated check.
3. Maintain `ASSETS/ATTRIBUTIONS.md` (created in Phase B). Every non-CC0 asset gets an entry.
   **No asset ships without a known, compatible license.**
4. Honor the **quality floor** on every screen: responsive to mobile, visible keyboard focus,
   `prefers-reduced-motion` respected, WCAG-AA contrast. These are not optional tasks; they
   are acceptance criteria baked into each Verify.

---

## DESIGN DIRECTION — "Lakeside dusk, enamel & lantern"

The name is a coined word: *tarn* (a still mountain lake) under a *veil* of mist. The UI sits
**on top of** a living isometric world, so its job is to let a player read their state and act
fast **without burying the world**. The identity is deliberately not medieval-fantasy serif
cliché and not flat-material SaaS: it's **weathered enamelware and brass against a twilit,
misty lake** — chrome that feels like crafted signage, not browser cards.

**The one job of every panel:** be legible over a moving world, then get out of the way.

### Tokens (the single source of visual truth — Phase A builds these)

**Color** (6 named values):

```
--ink:     #0E1B22   /* deep teal-slate; world scrim & deepest bg            */
--slate:   #16313B   /* panel base (frosted "lakeglass")                     */
--mist:    #DCE6E4   /* primary text / hairlines; moonlit off-white          */
--lake:    #2F8E8C   /* interactive / links / selection; mid teal            */
--lantern: #E8A14B   /* CTAs + the GOLD currency; warm amber (use sparingly) */
--rust:    #C2562F   /* danger, death, PvP, destructive actions              */
```

Plus two muted supports: `--reed: #9CB07A` (nature/skills) and `--brass: #C8A668` (corner
ticks, dividers). Never introduce a color outside this set without recording why.

**Type** (three roles, all open-licensed, self-hosted via Fontsource — see Phase B):

- **Display — Bricolage Grotesque.** Characterful, slightly irregular grotesque. Used *with
  restraint* for screen titles, the wordmark, and big numbers. Not a fantasy serif.
- **Body/UI — Hanken Grotesk.** Warm, highly legible at small sizes — labels, buttons, chat.
- **Numeric/Utility — Spline Sans Mono.** **Tabular figures** for gold/token counts, timers,
  coordinates, stats, and the marketplace — numbers must never jitter as they change.

**Layout:** panels are **anchored to screen edges** (HUD bottom, chat bottom-left, minimap
top-right, menus as overlays), never centered cards floating in the middle, so the world stays
visible. 8px spacing grid. Border-radius small and consistent (6px). Hairline dividers in
`--mist` at 12% opacity.

**Signature element (spend boldness here, keep everything else quiet):** the **lakeglass
panel** — a frosted, slightly translucent `--slate` backdrop (backdrop-blur) with **L-shaped
brass corner ticks** instead of full borders, and a faint top-edge mist glow. This is the one
memorable, repeated motif. Damage/heal numbers and notifications use a subtle **water-ripple**
ease, not a generic pop. Don't add other decoration.

**Motion:** one orchestrated page-load reveal on the landing screen; hover/press
micro-feedback on controls; ambient drifting mist on menus. All gated behind
`prefers-reduced-motion: reduce` → cut to instant.

---

## ASSET SOURCES — where Claude Code pulls figures, and how

**Licensing discipline (read first):**

- **Prefer CC0** (public domain, no attribution). Kenney is the default first stop.
- **CC-BY / CC-BY-SA / OFL / MIT are fine** but require recording attribution in
  `ASSETS/ATTRIBUTIONS.md` (author, asset, source URL, license). CC-BY-SA art means
  derivatives stay CC-BY-SA — note that before editing.
- **Never** use ripped or copyrighted assets from commercial games, films, or brands
  (no Nintendo/Disney/real-MMO rips, no licensed sports/IP). If a pack has no clear license
  file, do not use it.
- Every itch.io / OpenGameArt download: open its license file and log it before use.

### Primary art (sprites, tiles, UI) — start here

| Source | What | License | How to pull |
|---|---|---|---|
| **Kenney** — kenney.nl/assets | Isometric tiles, RPG/roguelike packs, **UI packs**, game icons, audio. The default source. | **CC0** | Download pack zips from the asset pages; unzip into `ASSETS/raw/kenney/`. (Kenney also mirrors many packs on GitHub under `github.com/kenneynl`.) |
| **game-icons.net** | 4,000+ RPG/skill/item/ability SVG icons (swords, axes, fish, ores, potions). | **CC-BY 3.0** | `git clone https://github.com/game-icons/icons` → SVGs are in the repo, recolor to tokens. Log attribution. |
| **OpenGameArt.org** | Character sprites, tilesets, effects. Filter by license. | Mixed (filter **CC0/CC-BY**) | Manual download; check each submission's license; place in `ASSETS/raw/oga/`. |
| **Universal LPC Spritesheet Generator** | Animated humanoid character/NPC sprites (walk/attack), customizable. | **CC-BY-SA 3.0 / GPL 3.0** | Generator: `liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator`; source on GitHub. Export sheets to `ASSETS/raw/lpc/`. |
| **itch.io** (free assets) | Lots of free/CC0 isometric tilesets & FX packs. | Per-pack (verify) | Search "isometric tileset CC0 free"; download; read each pack's license. |

### Fonts — self-hosted, open-licensed

| Source | What | License | How to pull |
|---|---|---|---|
| **Fontsource** (npm) | The three chosen faces, self-hosted (no external CDN, GDPR-safe). | OFL/Apache | `pnpm add @fontsource/bricolage-grotesque @fontsource/hanken-grotesk @fontsource/spline-sans-mono` and `@import` the weights used. |
| **Google Fonts** | Same faces, fallback/preview. | OFL/Apache | Use only if not self-hosting; prefer Fontsource for privacy. |

### UI/chrome icons (app controls, not game-art)

| Source | What | License | How to pull |
|---|---|---|---|
| **Lucide** | Clean line icons for buttons, settings, close/X, arrows. | **ISC/MIT** | `pnpm add lucide` (or `lucide-static` for raw SVG). Recolor via `currentColor`. |
| **Phosphor** | Alternative icon set, multiple weights. | **MIT** | `pnpm add @phosphor-icons/core`. |

### Audio (SFX + ambient)

| Source | What | License | How to pull |
|---|---|---|---|
| **Kenney audio** | UI clicks, impacts, pickups, ambience. | **CC0** | Download audio packs from kenney.nl/assets. |
| **Freesound.org** | Specific SFX (water, chops, casts). | Per-sound (CC0/CC-BY — verify) | Account + API or manual download; log per-sound license. |
| **Pixabay** | Royalty-free music/ambient loops. | Pixabay license | Download; keep a record. |

### Placeholders & landing illustration

| Source | What | License | How to pull |
|---|---|---|---|
| **DiceBear** | Procedural avatars for player/NPC placeholders. | Per-style (many MIT/CC0) | `pnpm add @dicebear/core @dicebear/collection`. |
| **unDraw** | Open illustrations for the landing page. | Free (unDraw license) | undraw.co — download SVG, recolor to `--lake`. |
| **OpenMoji** | Emoji set for chat emotes. | **CC-BY-SA 4.0** | `pnpm add openmoji` or download SVGs; log attribution. |

### Tooling

- **Tiled** (mapeditor.org) — author isometric tilemaps, export Tiled JSON; Phaser loads it.
- **free-tex-packer** (CLI/npm) — pack sprites into atlases Phaser can stream
  (`pnpm add -D free-tex-packer-core`). Atlases cut draw calls.

---

## PHASE A — Design system foundation

### TASK A1 — Tokens + theme module

- **Goal:** the palette/spacing/radius live in one importable place.
- **Steps:** create `packages/client/src/ui/theme.ts` (and matching CSS custom properties)
  exporting the six colors, `--reed`/`--brass`, the 8px spacing scale, radius (6px), and
  z-index layers (world < hud < panels < modals < toasts).
- **Files:** `theme.ts`, `theme.css`.
- **Verify:** **automated** — a unit test imports the token module and asserts all six core
  colors and the spacing scale exist; no screen file defines a raw hex (grep guard: fail if a
  `#xxxxxx` literal appears outside `theme.*`).
- **Commit:** `feat(ui): design tokens and theme module (lakeside-dusk)`

### TASK A2 — Typography

- **Goal:** the three faces self-hosted with a clear type scale.
- **Steps:** install the Fontsource packages; define the scale (display 32/24/20, body 16/14,
  mono 14/12) and weights; bind tabular figures (`font-variant-numeric: tabular-nums`) to all
  numeric/mono usage.
- **Files:** font imports, `type.css`.
- **Verify:** fonts load **self-hosted** (no external font CDN request in the network panel);
  a numeric readout doesn't change width when digits change (tabular figures confirmed).
- **Commit:** `feat(ui): self-hosted typography with tabular numerics`

### TASK A3 — Core components: the lakeglass panel + primitives

- **Goal:** the signature panel and shared controls, used everywhere.
- **Steps:** build `Panel` (frosted `--slate`, backdrop-blur, brass L-corner ticks, top mist
  glow), `Button` (primary = `--lantern`, secondary = `--lake` outline, danger = `--rust`),
  `Tooltip`, `Tabs`, `Slot` (inventory cell), `Bar` (HP/XP), `Toast`. All respect reduced
  motion and keyboard focus.
- **Files:** `packages/client/src/ui/components/*`.
- **Verify:** a component gallery route renders every primitive; **automated** axe/contrast
  check passes AA on text; tabbing reaches every interactive element with a visible focus ring;
  with `prefers-reduced-motion` set, no transitions fire.
- **Commit:** `feat(ui): lakeglass panel and core component primitives`

---

## PHASE B — Asset pipeline

### TASK B1 — Asset folders + attribution ledger

- **Goal:** a clean intake structure and a license record.
- **Steps:** create `ASSETS/raw/` (downloads), `packages/client/public/assets/` (shipped),
  and `ASSETS/ATTRIBUTIONS.md` with a table (asset, author, source URL, license).
- **Verify:** folders exist; `ATTRIBUTIONS.md` has the header row and a stated rule: CC0
  preferred, every non-CC0 asset logged.
- **Commit:** `chore(assets): asset intake structure and attribution ledger`

### TASK B2 — Pull the base art set

- **Goal:** acquire the starting kit, license-clean.
- **Steps:** pull Kenney isometric tiles + a UI pack (CC0); `git clone` game-icons for
  skill/item icons (CC-BY — log it); generate one LPC character sheet for the player (log
  CC-BY-SA); install Lucide for chrome icons. Place originals in `ASSETS/raw/`, log non-CC0
  entries in `ATTRIBUTIONS.md`.
- **Verify:** **automated** — a license check script scans `ASSETS/raw/*` against
  `ATTRIBUTIONS.md` and fails if any folder lacks an entry (CC0 may be marked CC0).
- **Commit:** `feat(assets): base isometric tiles, RPG icons, player sprite, UI icons`

### TASK B3 — Process & atlas

- **Goal:** ship-ready, optimized assets.
- **Steps:** recolor icons to tokens (CC-BY only; respect SA share-alike), trim/pad sprites,
  pack into atlases with free-tex-packer, optimize PNG/SVG, output to
  `public/assets/{tiles,sprites,icons,ui}/`.
- **Verify:** Phaser loads the atlas(es) without error; total initial asset payload is
  reported and reasonable; no raw multi-MB PNGs ship.
- **Commit:** `feat(assets): optimized atlases and token-recolored icons`

---

## PHASE C — Screens & features

Every screen reads branding from `GAME` (R8), uses Phase A components, and meets the quality
floor in its Verify.

### TASK C1 — Landing / splash (with live spectate chat)

- **Goal:** the marketing front door; one orchestrated load reveal.
- **Steps:** hero shows the world's most characteristic thing (a misty lake vista / live
  isometric scene), the wordmark from `GAME.name`, `GAME.tagline`, a primary **"Enter
  Tarnveil"** CTA, and a **live world-chat feed** polled from the Phase 4 spectate endpoint
  (proof the world is alive — strong hook). One page-load animation; reduced-motion safe.
- **Verify:** CTA routes to sign-in; the chat feed streams real messages via the cacheable
  poll; tab title and wordmark read `GAME.name`; load reveal disabled under reduced motion.
- **Commit:** `feat(ui): landing screen with live spectate chat`

### TASK C2 — Wallet connect / sign-in

- **Goal:** clear, trustworthy wallet sign-in.
- **Steps:** wallet-connect screen (sign a message, never a seed phrase), states for
  connecting / signature requested / rejected / wrong network, and the token-gate result
  ("you need X `GAME.tokenSymbol` to enter"). Error copy is plain and actionable, in the
  interface's voice.
- **Verify:** each state renders distinctly; rejection gives a recovery action, not a dead
  end; gating message uses `GAME.tokenSymbol`.
- **Commit:** `feat(ui): wallet sign-in and token-gate screen`

### TASK C3 — Character select / create

- **Goal:** pick or create a character.
- **Steps:** character cards (name, level summary), create flow with appearance options driven
  by the LPC sprite layers, empty-state copy that invites action.
- **Verify:** create persists and returns to select; keyboard-navigable; empty state reads as
  an invitation, not a blank.
- **Commit:** `feat(ui): character select and creation`

### TASK C4 — In-world HUD

- **Goal:** read core state at a glance without hiding the world.
- **Steps:** bottom-anchored **action bar/hotbar**; **HP bar**; the five **skill XP bars** with
  level; top-right **minimap** + coordinates + online count; a **currency cluster** showing
  `goldLabel` (amber) and token balance in tabular mono. Edge-anchored, translucent, never
  center-screen.
- **Verify:** HUD overlays a moving world while keeping it visible; all numbers tabular and
  jitter-free; scales from desktop down to a phone viewport (touch-sized targets).
- **Commit:** `feat(ui): in-world HUD (vitals, skills, minimap, currency)`

### TASK C5 — Inventory

- **Goal:** manage carried items.
- **Steps:** grid of `Slot`s, drag-and-drop reorder, rich tooltips (icon, name, stats), context
  actions (use/equip/drop/sell), stack counts in mono. Mirrors server state (R1) — UI only
  requests, server confirms.
- **Verify:** drag reorders optimistically and reconciles to server truth; tooltips keyboard-
  reachable; a rejected action (e.g., drop in safe zone) shows a clear inline reason.
- **Commit:** `feat(ui): inventory grid with drag, tooltips, context actions`

### TASK C6 — Bank & equipment / character sheet

- **Goal:** storage and gear.
- **Steps:** multi-page **bank** (tabs/pages, search, deposit/withdraw with quantity); **equipment
  doll** + derived stats panel; transfer between inventory/bank/equipment.
- **Verify:** no item duplication or loss across transfers (server-confirmed); pagination and
  search work; stats update from server state.
- **Commit:** `feat(ui): banking and equipment/character sheet`

### TASK C7 — Skills panel

- **Goal:** see progression.
- **Steps:** the five skills with level (cap 20), XP bar to next level, and what each unlocks;
  game-icons art per skill, recolored to tokens.
- **Verify:** levels/XP match server; never displays above 20; reduced-motion safe progress
  fills.
- **Commit:** `feat(ui): skills progression panel`

### TASK C8 — Gathering & combat feedback

- **Goal:** make actions feel responsive and legible.
- **Steps:** on-node **progress ring** while gathering; floating **"+N item"**; mob **health
  bars**; floating **damage/heal numbers** with the water-ripple ease (`--rust` damage,
  `--reed` heal); **death screen / tombstone** UI for PvP loss with clear recovery info.
- **Verify:** numbers read clearly over a busy scene and don't overlap into noise; all outcome
  values come from the server (R1); ripple motion cut under reduced motion.
- **Commit:** `feat(ui): gathering and combat feedback (rings, floats, death screen)`

### TASK C9 — Marketplace (gold) + gold↔token bridge

- **Goal:** browse, list, buy — safely and legibly.
- **Steps:** **browse** view (cacheable reads, filters, sort, prices in mono); **list item**
  flow with escrow confirmation; **buy** flow with confirm. Separate **gold-for-token** panel
  showing the **live token/USD quote at quote time**, the 95/5 split, and a wallet-signature
  confirm step; settlement state reflects on-chain confirmation (gold only credited after the
  server verifies the tx).
- **Verify:** browse hits cache (fast, no game-server load); listing escrows visibly; the
  token panel shows the live quote and the split, and the success state only appears after
  confirmation; all money figures tabular.
- **Commit:** `feat(ui): marketplace browse/list/buy and gold-for-token bridge`

### TASK C10 — Chat panel

- **Goal:** the social spine, on the cheap fanout transport.
- **Steps:** channel **tabs** (World / Local / DMs), the feed polled from
  `/api/chat?after=…&region=…&shard=…`, input with send, rate-limit feedback ("slow down"),
  mention/emote support (OpenMoji), mute, and unread badges. Bottom-left anchored, collapsible.
- **Verify:** messages stream via polling with the cursor advancing; over-rate input is gently
  blocked with clear copy; muting hides a sender; panel collapses without losing the world.
- **Commit:** `feat(ui): multi-channel chat panel on fanout polling`

### TASK C11 — Quests panel

- **Goal:** daily goals and claims.
- **Steps:** daily quest list with progress bars, reward preview (gold + XP), claim button,
  and a reset countdown in mono. Empty/all-done state gives direction.
- **Verify:** progress matches server; claim pays once and disables; countdown ticks; done-state
  copy invites the next action.
- **Commit:** `feat(ui): daily quests panel`

### TASK C12 — Social / friends

- **Goal:** find and reach people.
- **Steps:** friends list with presence ("online — in Tarnmere"), add/accept requests, open DM,
  block. Presence dot uses `--reed` online / `--mist` 40% offline.
- **Verify:** request requires acceptance; presence reflects real zone; DM opens the right chat
  tab.
- **Commit:** `feat(ui): friends and presence`

### TASK C13 — Notifications / toasts

- **Goal:** transient feedback that never blocks play.
- **Steps:** a toast stack (top-right, below minimap) for loot, level-ups, trade results,
  errors. Errors explain what happened and the fix, in the interface's voice — no apologies,
  no vagueness.
- **Verify:** toasts auto-dismiss, stack without overlap, are screen-reader announced
  (aria-live), and pause under reduced motion (no slide, just fade/instant).
- **Commit:** `feat(ui): toast notification system`

### TASK C14 — Settings

- **Goal:** player control over experience and access.
- **Steps:** tabs for Audio (master/SFX/music), Graphics (quality, mist on/off), Controls
  (keybinds), and **Accessibility** (reduced motion, colorblind-safe palette swap, UI text
  size). Labels name what the player controls, not system internals.
- **Verify:** each setting persists and takes effect live; the colorblind palette keeps AA
  contrast; reduced-motion toggle visibly disables animation everywhere.
- **Commit:** `feat(ui): settings with accessibility controls`

### TASK C15 — Loading & zone transitions

- **Goal:** cover async gaps gracefully.
- **Steps:** branded loading screen (wordmark from `GAME.name`, a quiet mist animation, a tip
  line), and a quick veil-wipe transition between zones on portal use.
- **Verify:** no flash-of-unstyled content; transition respects reduced motion (cross-fade or
  instant); asset loads show progress, not a frozen screen.
- **Commit:** `feat(ui): branded loading and zone-transition screens`

---

## PHASE D — Polish & QA (run after Phase C)

- **TASK D1 — Responsive & touch:** every panel works from desktop to a phone; add on-screen
  touch controls (virtual joystick / tap-to-move) for mobile. **Verify:** playable on a phone
  viewport; no panel overflows or traps focus.
- **TASK D2 — Accessibility pass:** full keyboard play, focus order, aria-live for combat/chat,
  AA contrast everywhere, reduced-motion honored globally. **Verify:** automated axe scan is
  clean; a keyboard-only run reaches every feature.
- **TASK D3 — Performance:** atlas all sprites, lazy-load non-critical panels, cap HUD
  re-renders, measure FPS with many entities on screen. **Verify:** steady frame rate under a
  crowded-zone stress scene; initial load payload within budget.
- **TASK D4 — Consistency sweep ("remove one accessory"):** audit every screen against the
  tokens and components; delete one-off styles, stray colors, and decoration that doesn't serve
  the brief. **Verify:** grep guard finds no raw hex or off-scale spacing outside `theme.*`;
  the signature lakeglass treatment is consistent on every panel.
- **TASK D5 — License audit:** reconcile `public/assets/*` against `ATTRIBUTIONS.md`; confirm
  no asset lacks a compatible license and CC-BY-SA derivatives are marked. **Verify:** the
  license check script passes with zero unlogged assets.

---

## DEFINITION OF DONE (frontend)

- [ ] Design tokens, typography, and the lakeglass component kit are the single source for all UI.
- [ ] All assets are pulled from license-clear sources and fully logged in `ATTRIBUTIONS.md`
      (CC0 preferred; CC-BY/SA attributed; no copyrighted rips).
- [ ] Every screen in Phase C is built, reads branding from `GAME` config (R8), and reflects
      server-authoritative state (R1).
- [ ] Quality floor holds everywhere: responsive to mobile, keyboard-navigable with visible
      focus, reduced-motion respected, AA contrast.
- [ ] Phase D passes: performance, accessibility, consistency, and license audits all green.
