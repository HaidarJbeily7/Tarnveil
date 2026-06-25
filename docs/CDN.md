# CDN configuration

The HTTP API runs behind a CDN (Cloudflare or Fastly per the pinned stack).
This file lists every route's cache behaviour so the edge can be configured
to pass-through writes and cache reads exactly where they're safe.

## Cacheable read routes

| Route | Cache-Control | Notes |
|---|---|---|
| `GET /api/chat` (no auth header) | `public, max-age=1` | Per-channel chat fanout (Appendix B). The CDN collapses identical `after=X` polls for ~1 s. |
| `GET /api/chat` (with `x-character-id`) | `private, max-age=1` | Per-viewer mute filtering — must never leak between viewers. |
| `GET /api/market` | `public, max-age=2` | Browse path. Listings only flip to `sold` once, so 2 s of staleness is benign. |
| `GET /spectate` | `public, max-age=60` | Static HTML; the page itself polls `/api/chat` from the client. |
| `GET /health` | (no header) | Origin-only liveness for orchestration. |

## Pass-through routes (never cached)

All writes (`POST`, `DELETE`) and the authoritative reads below should bypass
the edge cache entirely:

- `POST /api/chat`, `POST /api/mute`, `DELETE /api/mute`
- `POST /api/friends/request`, `POST /api/friends/accept`, `GET /api/friends`
- `POST /api/dm/:peer`, `GET /api/dm/:peer`
- `GET /api/presence/:characterId`
- `GET /api/character/:id`
- `POST /api/market/list`, `POST /api/market/buy/:id`
- `POST /api/cosmetic/buy`
- `GET /api/admin/economy`, `GET /api/admin/metrics`

## Edge configuration

1. **Cache key includes** the full querystring on `/api/chat` and `/api/market`
   so different `after=`/`region=`/`shard=` slices stay separate.
2. **Strip the `x-character-id` request header** from the cache key on
   `/api/chat` and downgrade `private` responses to MISS — this is how the
   edge keeps a muter's filtered view out of someone else's response.
3. **Honour origin Cache-Control**: do not override `max-age` lower than the
   origin's value; the values above are picked to be invisible-latency for
   chat (1 s) and acceptable for browse (2 s).
4. **Stale-while-revalidate**: optional. If supported, set
   `stale-while-revalidate=5` on chat and market via an edge rule — origin
   stays small under bursts.

## Verifying cache hit ratio

Under load against `/api/chat?after=X` from many viewers polling the same
shard:

```sh
hey -n 5000 -c 50 -H "Accept: application/json" \
  "https://<cdn>/api/chat?after=0&region=global&shard=0"
```

The edge dashboard should report a near-100 % hit ratio after the first
request fills the cache; the origin's request counter (see
`GET /api/admin/metrics`) should grow by roughly one per second of test
duration, not one per request.

## Known carve-outs

- The chat read path that includes `x-character-id` returns `Cache-Control:
  private`. The edge MUST treat this as un-cacheable per the rules above
  even though `max-age` is non-zero — the per-viewer mute filter is the
  reason.
- The spectate page is static and embeds the same `/api/chat` URL the
  authenticated client uses; both go through the edge cache, the spectator
  just never sends the auth header.
