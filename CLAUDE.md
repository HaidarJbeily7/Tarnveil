# CLAUDE.md — Tarnveil project conventions

> Working title is configurable: see `packages/shared/game.config.ts` and Rule R8.
> Anything user-facing must derive from `GAME` — no hardcoded name strings.

## Global rules (invariants)

- **R1 Server is authoritative.** Client sends intent only; server decides every outcome.
- **R2 Match transport to latency tolerance.** Realtime → WebSocket (Colyseus). Chat,
  market browse, leaderboards → HTTP polling behind a CDN.
- **R3 Separate read path from write path.** Cacheable reads via `api`, never via `realtime`.
- **R4 Off-chain economy.** All gameplay runs on `Gold`. Token only at cash-in/out (Phase 6).
- **R5 Every currency/XP mutation is logged** to an append-only ledger with actor, amount,
  reason, timestamp.
- **R6 Shared types.** Client/server message + entity types live in `@tarnveil/shared`.
- **R7 Validate all input** server-side: range, cooldowns, rate limits, ownership.
- **R8 No hardcoded game identity.** Read from `GAME` config; CI greps for the literal name.

## Pinned stack

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| Client | Phaser 3 + Vite |
| Realtime | Node.js + Colyseus |
| HTTP API | Node.js + Fastify |
| DB | PostgreSQL + Drizzle ORM |
| Ephemeral | Redis (ioredis) |
| Tests | Vitest + Playwright |
| Monorepo | pnpm workspaces |

Pin exact versions in each `package.json`. Don't upgrade mid-build without a reason.

## Repo layout

```
.
├── CLAUDE.md
├── BUILD_SPEC.md                 # the authoritative build plan
├── docker-compose.yml            # postgres (5433) + redis (6380)
├── .env.example
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── infra/migrations/             # numbered SQL files, applied by api migrate script
└── packages/
    ├── shared/                   # types, message envelopes, constants, game.config.ts
    ├── client/                   # Phaser 3 (Vite)
    ├── realtime/                 # Colyseus zones
    └── api/                      # Fastify HTTP server
```

Host ports differ from the spec defaults because 5432/6379 are already bound on the
local dev machine: postgres → 5433, redis → 6380.

## Run commands

From the repo root unless noted.

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace deps |
| `docker compose up -d` | Start postgres + redis containers |
| `docker compose down` | Stop them (volumes are kept) |
| `pnpm --filter @tarnveil/api smoke` | Connect to postgres and redis, exit 0 if both up |
| `pnpm --filter @tarnveil/api migrate` | Apply pending SQL migrations from `infra/migrations/` |
| `pnpm --filter @tarnveil/shared typecheck` | Typecheck `shared` |
| `pnpm --filter @tarnveil/client typecheck` | Typecheck `client` |
| `pnpm --filter @tarnveil/realtime typecheck` | Typecheck `realtime` |
| `pnpm --filter @tarnveil/api typecheck` | Typecheck `api` |
| `pnpm typecheck` | Typecheck the whole monorepo |

Future tasks will add `dev`, `build`, and `test` scripts per package. Keep this table
current — when a phase adds a new command, update CLAUDE.md in the same commit.

## Test commands

Tests will be added per phase. Once present:

| Command | What it does |
|---|---|
| `pnpm --filter @tarnveil/shared test` | Vitest unit tests for shared (iso math, GAME config, etc.) |
| `pnpm --filter @tarnveil/realtime test` | Colyseus room tests |
| `pnpm --filter @tarnveil/api test` | API integration tests against postgres + redis |
| `pnpm --filter @tarnveil/client test` | Client unit tests (Playwright e2e under `e2e/`) |

## Working agreement for an agent in this repo

1. Follow `BUILD_SPEC.md` strictly. One TASK at a time. Run Verify before moving on.
2. Treat the Global Rules as invariants — every change must respect them.
3. Don't introduce the literal name of the game outside `packages/shared/game.config.ts`.
4. Don't touch Phase 6 until a human confirms Appendix D legal sign-off.
5. Keep this file current as conventions evolve.
