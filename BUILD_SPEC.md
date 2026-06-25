# BUILD_SPEC — Tarnveil: Isometric Browser MMO with Two-Currency Economy

> **Working title: `Tarnveil`.** The name is **fully configurable** from a single source
> (see **GAME CONFIG** below and **Rule R8**). To rebrand the entire game, change one value —
> never hardcode the name anywhere else.

> **For Claude Code (or any coding agent).** This is an executable build spec, not prose.
> Work top to bottom. Complete **one TASK at a time**, run its **Verify** step, and only
> move on when it passes. Commit after each task using the given commit message. If a Verify
> step fails, fix it before advancing. Treat the **Global Rules** as invariants that every
> task must respect.

---

## HOW TO USE THIS FILE

1. Start at **SETUP**, then do phases in order. Within a phase, do TASKs in numeric order.
2. Each TASK has: **Goal → Steps → Files → Verify → Commit**. The **Verify** line is the
   definition of done. Prefer the automated check; where a check is manual, perform it and
   report the result before continuing.
3. Keep `CLAUDE.md` (created in SETUP) updated as conventions evolve so future sessions have
   project context.
4. Do not start **Phase 6 (crypto)** until the note at the top of that phase is satisfied.
5. Ask the human before: incurring any paid service, launching anything on-chain, or
   deviating from the pinned stack.

---

## GLOBAL RULES (invariants — never violate)

- **R1 Server is authoritative.** The client sends *intent* only (move-to, chop-this,
  buy-this). The server validates and decides every outcome. No gameplay outcome, currency
  change, or XP gain is ever computed client-side.
- **R2 Match transport to latency tolerance.** Movement/combat → WebSocket. Chat, market
  browse, leaderboards → HTTP polling behind a CDN cache. Never put lag-tolerant read traffic
  on the realtime server.
- **R3 Separate read path from write path.** Cacheable reads are served by the HTTP API
  process, never by the realtime (Colyseus) process.
- **R4 Off-chain economy.** All gameplay runs on in-game **gold**. The on-chain token appears
  only at the cash-in/cash-out boundary (Phase 6).
- **R5 Every currency/XP mutation is logged** to an append-only ledger table with actor,
  amount, reason, and timestamp. No silent balance edits.
- **R6 Shared types.** Client/server message and entity types live in a shared package and
  are imported by both. Message shapes never drift.
- **R7 Validate all input** server-side: range checks, cooldowns, rate limits, ownership.
  Assume the client is hostile.
- **R8 No hardcoded game identity.** The game name (and other branding) is read from the
  single `GAME` config (see **GAME CONFIG**). No file may hardcode the literal name; the
  browser tab title, HUD, splash, API service name, and docs all derive it from config.

---

## PINNED STACK

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) everywhere |
| Client | Phaser 3, bundled with Vite |
| Realtime server | Node.js + Colyseus (one room per zone) |
| HTTP API | Node.js + Fastify |
| Durable DB | PostgreSQL (via Prisma or Drizzle ORM) |
| Ephemeral store | Redis (positions, chat tail, rate limits, presence) |
| Tests | Vitest (unit/integration), Playwright (e2e/manual harness) |
| Monorepo | pnpm workspaces |
| Containers | Docker + docker-compose for local Postgres/Redis |
| CDN (later) | Cloudflare/Fastly in front of HTTP API |
| Crypto (Phase 6) | @solana/web3.js, @solana/wallet-adapter |

Pin exact versions in `package.json` at SETUP and do not upgrade mid-build without a reason.

---

## GAME CONFIG (single source of truth for branding)

The game's identity lives in **one** place and everything else derives from it (Rule R8).

**Source of truth:** `packages/shared/game.config.ts`, overridable by environment variable so
deploys can rebrand without code changes.

```ts
// packages/shared/game.config.ts
export const GAME = {
  /** Display name — change this one value to rebrand the whole game. */
  name: process.env.GAME_NAME ?? "Tarnveil",
  /** Lowercase slug derived from name; used for ids, room namespaces, asset paths. */
  get slug() { return this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); },
  /** On-chain token ticker (Phase 6). */
  tokenSymbol: process.env.GAME_TOKEN_SYMBOL ?? "TARN",
  /** In-game soft currency label. */
  goldLabel: process.env.GAME_GOLD_LABEL ?? "Gold",
  /** Marketing tagline (optional, for splash/landing). */
  tagline: process.env.GAME_TAGLINE ?? "An isometric world to gather, fight, and trade.",
} as const;
```

**Consumption rules:**

- Client: browser tab `document.title`, splash screen, and HUD read `GAME.name`. Never a
  string literal.
- Realtime: room/zone namespaces and logs use `GAME.slug`.
- API: service name, health endpoint, and any branded response use `GAME.name` / `GAME.slug`.
- Env override: setting `GAME_NAME=Foo` (and optionally `GAME_TOKEN_SYMBOL`, etc.) renames
  everything on the next boot with no code edits.

**Current values:** name `Tarnveil`, token symbol `TARN`, gold label `Gold`. These are the
defaults — override per environment as needed.

---

## TARGET REPO STRUCTURE

```
.
├── CLAUDE.md                  # project conventions for the agent
├── docker-compose.yml         # local postgres + redis
├── package.json               # pnpm workspace root
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/                # shared TS types, message schemas, constants, game.config.ts
│   ├── client/                # Phaser 3 game (Vite)
│   ├── realtime/              # Colyseus server (zones)
│   └── api/                   # Fastify HTTP server (auth, chat, market, reads)
└── infra/
    └── migrations/            # SQL migrations
```

---

## SETUP

### TASK S1 — Initialize monorepo

- **Goal:** working pnpm workspace with the four packages.
- **Steps:** init pnpm workspace; create `packages/{shared,client,realtime,api}` each with a
  `package.json`; add root TypeScript config with strict mode; add `pnpm-workspace.yaml`.
- **Files:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, per-package
  `package.json` + `tsconfig.json`.
- **Verify:** `pnpm install` succeeds and `pnpm -r exec tsc --noEmit` passes with no files.
- **Commit:** `chore: initialize pnpm monorepo with shared/client/realtime/api packages`

### TASK S2 — Local infra

- **Goal:** Postgres + Redis runnable locally.
- **Steps:** write `docker-compose.yml` exposing Postgres and Redis; add `.env.example` with
  connection strings; add ORM and run an initial empty migration.
- **Files:** `docker-compose.yml`, `.env.example`, ORM config, `infra/migrations/0001_init.sql`.
- **Verify:** `docker compose up -d` starts both; a connection smoke-test script connects to
  each and exits 0.
- **Commit:** `chore: add docker-compose for postgres and redis with initial migration`

### TASK S3 — Write CLAUDE.md

- **Goal:** persistent project context for the agent.
- **Steps:** create `CLAUDE.md` summarizing the Global Rules, the pinned stack, the repo
  layout, how to run each package, and the test commands. Keep it short and current.
- **Verify:** file exists and lists run/test commands for every package.
- **Commit:** `docs: add CLAUDE.md with conventions and run commands`

### TASK S4 — Shared package skeleton

- **Goal:** one place for cross-cutting types/constants.
- **Steps:** in `packages/shared`, export entity types (Player, Tile, Item, SkillId), the
  message envelope types for client↔server, and game constants (tile size, skill cap = 20).
- **Verify:** `client`, `realtime`, and `api` can each import a symbol from `shared` and
  typecheck.
- **Commit:** `feat(shared): add core types, message envelopes, and constants`

### TASK S5 — Game config (single source of branding)

- **Goal:** one configurable place for the game's identity (Rule R8).
- **Steps:** create `packages/shared/game.config.ts` exactly as in **GAME CONFIG** (default
  name `Tarnveil`, token `TARN`); export `GAME`; add `GAME_NAME` (+ optional
  `GAME_TOKEN_SYMBOL`, `GAME_GOLD_LABEL`, `GAME_TAGLINE`) to `.env.example`.
- **Files:** `packages/shared/game.config.ts`, `.env.example`.
- **Verify:** **automated** — a Vitest test asserts (a) `GAME.name === "Tarnveil"` by default,
  (b) setting `GAME_NAME=Foo` in the environment yields `GAME.name === "Foo"` and
  `GAME.slug === "foo"`. **Grep guard:** a test/CI check greps `packages/{client,realtime,api}`
  for the literal `Tarnveil` and fails if found outside `shared/game.config.ts` (enforces R8).
- **Commit:** `feat(shared): configurable game identity via GAME config and env override`

---

## PHASE 0 — Single-player isometric prototype

### TASK 0.1 — Phaser app boots

- **Goal:** blank Phaser canvas served by Vite, branded from config.
- **Steps:** set `document.title` and any splash/loading text from `GAME.name` (R8) — no
  literal name.
- **Verify:** `pnpm --filter client dev` serves a page rendering an empty Phaser scene with
  no console errors, and the browser tab reads `Tarnveil` (and changes if `GAME_NAME` is set).
- **Commit:** `feat(client): bootstrap phaser scene with vite, title from GAME config`

### TASK 0.2 — Isometric tilemap + coordinate math

- **Goal:** render a diamond-tile grid; convert screen↔tile correctly.
- **Steps:** implement `tileToScreen` and `screenToTile` (formulas in Appendix A) in
  `shared`; render an NxN ground grid; draw back-to-front sorted by `col + row`.
- **Files:** `packages/shared/iso.ts`, client render code.
- **Verify:** **automated** — Vitest unit tests assert `screenToTile(tileToScreen(c,r)) === (c,r)`
  for a range of coordinates. Visual: grid renders as diamonds.
- **Commit:** `feat: isometric coordinate transforms with round-trip tests`

### TASK 0.3 — Click-to-move with A*

- **Goal:** click a tile, character pathfinds and walks there.
- **Steps:** A* over the walkable grid; animate movement tile-to-tile.
- **Verify:** **automated** — unit test: A* returns shortest path around a blocked tile, and
  returns empty for unreachable targets. Manual: clicking moves the avatar.
- **Commit:** `feat(client): click-to-move pathfinding on the iso grid`

### TASK 0.4 — Choppable tree (local)

- **Goal:** the core action feels good before networking.
- **Steps:** place a tree; on click within range, play chop animation, increment a local
  wood counter shown in a HUD inventory slot.
- **Verify:** Manual: clicking the tree in range yields "+1 wood" in the HUD; out of range
  does nothing.
- **Commit:** `feat(client): choppable tree with HUD wood counter (local)`

**Phase 0 exit criteria:** walk an iso map and chop a tree to gain wood, fully client-side.

---

## PHASE 1 — Authoritative multiplayer core

### TASK 1.1 — Colyseus room + zone state

- **Goal:** a server-owned room holding player positions.
- **Steps:** define room state schema (players map: id→{col,row}); handle join/leave/spawn.
- **Verify:** **automated** — Colyseus test client joins, appears in state, leaves and is
  removed.
- **Commit:** `feat(realtime): colyseus zone room with authoritative player state`

### TASK 1.2 — Server-authoritative movement

- **Goal:** move client intent to the server.
- **Steps:** client sends `move-to {col,row}`; server validates walkable + reachable, updates
  state, broadcasts. Client renders from server state only.
- **Verify:** **automated** — sending a move to a blocked/unreachable tile does not change
  server position; a valid move does. Manual: two browser tabs see each other move.
- **Commit:** `feat(realtime): server-validated movement (R1, R7)`

### TASK 1.3 — Interpolation

- **Goal:** smooth motion for remote players.
- **Steps:** client interpolates other players between the last two server snapshots.
- **Verify:** Manual: remote avatar glides instead of teleporting; tampering with the client
  cannot move a player through a wall (re-confirm R1).
- **Commit:** `feat(client): interpolate remote players between server snapshots`

**Phase 1 exit criteria:** two browsers share one server-authoritative world; client edits
cannot cheat movement.

---

## PHASE 2 — Core gameplay loops

### TASK 2.1 — Persistent inventory

- **Goal:** inventory lives in Postgres, server-owned.
- **Steps:** schema for characters + inventory items; load on join, save on change; ledger
  table per R5.
- **Verify:** **automated** — integration test: add item → restart server process → item
  still present.
- **Commit:** `feat: persistent server-authoritative inventory with ledger`

### TASK 2.2 — Resource nodes + gathering

- **Goal:** server-controlled gather actions.
- **Steps:** trees/rocks/fishing spots with server-side respawn timers; `gather {nodeId}`
  validated for range, tool, cooldown; award resource server-side.
- **Verify:** **automated** — gather out of range / on cooldown / without tool is rejected;
  valid gather grants exactly one resource and starts the cooldown.
- **Commit:** `feat: server-validated gathering with respawn timers`

### TASK 2.3 — Skills + XP (cap 20)

- **Goal:** five skills (Combat, Woodcutting, Mining, Fishing, Cooking) with XP/levels.
- **Steps:** XP awarded only by the server on validated actions; level curve; hard cap 20.
- **Verify:** **automated** — XP only increases via server actions; level never exceeds 20;
  XP/level persist.
- **Commit:** `feat: five skills with server-awarded XP capped at level 20`

### TASK 2.4 — Mobs + combat

- **Goal:** server-resolved PvE.
- **Steps:** mob spawn, aggro radius, pathfind-to-player, HP/damage; combat math server-side;
  drops on death; player respawn.
- **Verify:** **automated** — damage and drops are computed server-side and survive a client
  that claims arbitrary damage; killing a mob yields its drop in inventory.
- **Commit:** `feat: server-authoritative mob combat with drops and respawn`

**Phase 2 exit criteria:** gather/fight/level loop works and survives a server restart.

---

## PHASE 3 — World: realms, portals, persistence

### TASK 3.1 — Multiple zones

- **Goal:** several rooms (Mainland hub, gathering realm, PvP wilderness, fishing realm).
- **Verify:** each zone boots independently; a player can be in exactly one zone at a time.
- **Commit:** `feat(realtime): multiple zone rooms`

### TASK 3.2 — Portals / zone handoff

- **Goal:** move a player between zones preserving state.
- **Verify:** **automated** — stepping on a portal removes the player from zone A and
  re-creates them in zone B with identical inventory/skills/gold.
- **Commit:** `feat: portal-based zone handoff preserving character state`

### TASK 3.3 — Banking + safe-zone healing

- **Goal:** multi-page bank storage and a healing fountain.
- **Verify:** **automated** — items move between inventory and bank without duplication or
  loss; standing in the safe zone regenerates HP over time, server-side.
- **Commit:** `feat: multi-page banking and safe-zone healing`

### TASK 3.4 — Full persistence + relog

- **Goal:** durable characters.
- **Verify:** **automated** — log out and back in restores position, inventory, bank, skills,
  and gold exactly.
- **Commit:** `feat: full character persistence across sessions`

**Phase 3 exit criteria:** portal between maps, bank items, relog into the exact same state.

---

## PHASE 4 — Social layer (cacheable chat fanout)

### TASK 4.1 — Chat fanout read endpoint

- **Goal:** the cheap, CDN-cacheable chat read path (Appendix B).
- **Steps:** in `api`, implement `GET /api/chat?after=<seq>&region=<r>&shard=<n>` returning
  messages with `id > after` from a Redis log keyed `chat:<region>:<shard>`, capped to N,
  with `Cache-Control: public, max-age=1`. Monotonic sequence ids.
- **Verify:** **automated** — seeding messages then requesting `after=X` returns only newer
  ones in order, capped; the response carries the cache header.
- **Commit:** `feat(api): cacheable chat fanout read endpoint`

### TASK 4.2 — Chat write + moderation

- **Goal:** authenticated, rate-limited posting.
- **Steps:** `POST /api/chat` appends to the Redis log and trims old entries; enforce rate
  limit (N msgs / rolling window), max length, mute, profanity filter.
- **Verify:** **automated** — over-limit posts are rejected; over-length rejected; muted
  sender's messages are hidden from the muter.
- **Commit:** `feat(api): rate-limited chat posting with moderation`

### TASK 4.3 — Spectate mode

- **Goal:** non-logged-in visitors can watch world chat (homepage hook).
- **Verify:** the read endpoint serves a feed without a session; a minimal static page polls
  and renders it.
- **Commit:** `feat: read-only spectate chat feed`

### TASK 4.4 — Friends + presence + DMs

- **Goal:** social graph.
- **Verify:** **automated** — friend request requires acceptance; presence reports correct
  online zone; DMs deliver only to the pair.
- **Commit:** `feat: friends, presence, and direct messages`

**Phase 4 exit criteria:** many clients poll chat through the cache with near-zero origin
load; homepage shows live world chat with no login.

---

## PHASE 5 — Economy: gold, merchants, marketplace, quests

### TASK 5.1 — Gold balances + ledger

- **Goal:** server-authoritative gold (R4, R5).
- **Verify:** **automated** — every gold change writes a ledger row; sum of ledger equals
  balance; no endpoint mutates gold without a ledger entry.
- **Commit:** `feat: gold balances backed by an append-only ledger`

### TASK 5.2 — NPC merchants

- **Goal:** baseline buy/sell sink+source.
- **Verify:** **automated** — selling grants gold and removes the item; buying does the
  reverse; insufficient gold is rejected.
- **Commit:** `feat: npc merchant buy/sell`

### TASK 5.3 — Player marketplace (gold)

- **Goal:** safe player-to-player trade via the HTTP API.
- **Steps:** item-for-gold listings with **escrow** (listed item held by the system) so items
  can't dup or vanish; cacheable browse endpoint; transactional buy.
- **Verify:** **automated** — listing escrows the item; a buy transfers gold→seller and
  item→buyer atomically; a failed/duplicate buy leaves state unchanged (no dup, no loss).
- **Commit:** `feat: escrowed player marketplace for gold`

### TASK 5.4 — Daily quests

- **Goal:** 24h-resetting objectives paying gold + XP.
- **Verify:** **automated** — quest progress only advances on validated server actions;
  completion pays once; quests reset after 24h.
- **Commit:** `feat: daily quests with server-validated progress`

### TASK 5.5 — Economy sinks + dashboard

- **Goal:** fight inflation and observe it.
- **Steps:** add sinks — repairs, bank-space fees, cosmetics, listing fees, PvP death item
  loss; build an admin view of total gold supply and daily inflation from the ledger.
- **Verify:** **automated** — each sink removes the correct gold and logs it; dashboard
  numbers reconcile against the ledger.
- **Commit:** `feat: economy sinks and supply/inflation dashboard`

**Phase 5 exit criteria:** a closed, observable gold economy — earn, trade safely, with
working sinks. **The game is shippable here with no crypto.**

---

## PHASE 6 — Crypto layer

> **DO NOT START** until a human confirms legal sign-off (Appendix D). The entire game runs
> on gold without this phase; treat the token strictly as a cash-in/cash-out boundary (R4).

### TASK 6.1 — Wallet sign-in

- **Goal:** authenticate by wallet signature, no seed phrases ever.
- **Steps:** client signs a server-issued nonce/message with the wallet; server verifies the
  signature and issues a session.
- **Verify:** **automated** — a valid signature authenticates; a forged/replayed signature is
  rejected.
- **Commit:** `feat(crypto): wallet message-signature sign-in`

### TASK 6.2 — Token-gating

- **Goal:** require a minimum balance of the configured token (`GAME.tokenSymbol`, default
  `TARN`) to play.
- **Verify:** **automated (devnet/mock)** — a wallet below the threshold is denied; at/above
  is admitted.
- **Commit:** `feat(crypto): minimum-token-balance gate`

### TASK 6.3 — Gold↔token marketplace bridge

- **Goal:** sell in-game gold for the on-chain token, verified server-side.
- **Steps:** seller lists gold at a USD price; token amount quoted from the **live token/USD
  price at quote time**; buyer pays in one on-chain tx; the **server verifies the on-chain
  transaction** before crediting gold; split proceeds (e.g. 95% seller / 5% treasury).
- **Verify:** **automated (devnet)** — gold is credited only after on-chain confirmation; an
  unconfirmed/insufficient payment credits nothing; the split is exact.
- **Commit:** `feat(crypto): server-verified gold-for-token settlement`

**Phase 6 exit criteria:** wallet sign-in, token gate, and a gold↔token sale that only moves
gold after the chain confirms — on devnet, behind legal sign-off for mainnet.

---

## PHASE 7 — Scale, anti-cheat, polish (ongoing)

- **TASK 7.1 Sharding:** add the `shard=N` dimension; route players and partition chat by
  shard. **Verify:** load split across shards; chat isolated per shard.
- **TASK 7.2 Anti-cheat:** rate/sanity bounds on every action (no 50 chops/sec); anomaly
  detection on gold/XP gain. **Verify:** synthetic cheat inputs are rejected and flagged.
- **TASK 7.3 Observability:** metrics (online players, economy totals, errors), structured
  logs, alerts. **Verify:** dashboards populate; an induced error fires an alert.
- **TASK 7.4 CDN:** put the CDN in front of the HTTP API; confirm chat/market reads hit edge
  cache. **Verify:** cache-hit ratio is high under load against `/api/chat`.
- **TASK 7.5 Live-ops:** content/event cadence, rare drops, cosmetics. **Verify:** an event
  can be configured and toggled without a redeploy.

---

## APPENDIX A — Isometric math

```
// tile (col,row) -> screen pixel
screenX = (col - row) * (tileWidth  / 2)
screenY = (col + row) * (tileHeight / 2)

// screen pixel -> tile (inverse)
col = (x / (tileWidth/2) + y / (tileHeight/2)) / 2
row = (y / (tileHeight/2) - x / (tileWidth/2)) / 2

// render order: sort drawables ascending by (col + row), draw back-to-front
```

Round-trip test: `screenToTile(tileToScreen(c,r))` must equal `(c,r)`.

## APPENDIX B — Chat fanout pattern

Server: keep a per-`(region,shard)` append-only log in Redis (sorted set / stream keyed
`chat:<region>:<shard>`), each message with a monotonic sequence id.

```
GET /api/chat?after=<seq>&region=<r>&shard=<n>
  -> messages where id > seq, ordered, capped to N (e.g. 50)
  -> Cache-Control: public, max-age=1   (CDN serves identical "after=X" to all clients)
POST /api/chat   (authed, rate-limited)  -> append + trim old entries
```

Client polls every ~1s, advancing `cursor = max(cursor, msg.id)`. Optional upgrade: long
polling (hold the request open a few seconds when nothing is new) to cut empty requests.
Rationale: stateless + edge-cacheable + firewall-friendly; 1s latency is invisible for chat.

## APPENDIX C — Two-currency economy model

Design as **sources** (value in) vs **sinks** (value out). If sources > sinks → inflation →
currency dies. Track total supply and daily inflation from the ledger from day one.

- **Gold (off-chain, all gameplay).** Sources: quests, gathering→merchants, mob drops, spins.
  Sinks: gear, repairs, bank fees, cosmetics, listing fees, PvP death item loss.
- **Token (on-chain, edges only).** Enters/exits only via the gold↔token bridge. A treasury
  cut and optional burns (e.g. half-burned paid spins) reduce supply. Note: a paid spin with
  no return-to-player is a pure sink and edges toward gambling mechanics (Appendix D).
- **Cash-out loop:** grind gold → list gold for token → buyer pays on-chain → hold a tradable
  token. Keep gameplay on gold; touch the chain only at conversion.

## APPENDIX D — Legal gate for Phase 6 (must clear before mainnet)

The game (Phases 0–5, gold only) is unremarkable software and needs none of this. The
**token + paid-chance mechanics** carry real, jurisdiction-specific risk:

- **Securities:** a token whose value derives from the team's efforts may be treated as a
  security; launch/marketing/distribution all matter.
- **Gambling:** a paid randomized-prize wheel can meet the legal definition of gambling
  (heavily regulated, varies by country/region; "no RTP" does not exempt it).
- **Money transmission / AML:** converting in-game value to a tradable on-chain asset can
  trigger money-transmitter and AML obligations.
- **Consumer protection / tax:** real-money trading, refunds, and player earnings carry
  duties.

**Action for the agent:** do not deploy any token or paid-chance mechanic to mainnet, and do
not start Phase 6 against mainnet, until a human confirms a crypto/gaming lawyer in the
target jurisdictions has signed off. Devnet/mock implementation for testing is fine.

---

## DEFINITION OF DONE (whole project)

- [ ] Phases 0–5 complete: a fun, persistent, multiplayer, gold-only game with a balanced,
      observable economy — shippable without crypto.
- [ ] Phase 6 complete on devnet, gated by Appendix D for mainnet.
- [ ] Phase 7 hardening in place: sharding, anti-cheat, observability, CDN, live-ops.
- [ ] Every TASK's Verify step passed; all Global Rules hold; the test suite is green.
