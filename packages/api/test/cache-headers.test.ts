import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../src/server.js";
import { resetChat, type ChatChannel } from "../src/chat/log.js";
import { closeRedis, getRedis } from "../src/redis.js";
import { closeDb } from "../src/db.js";

const CHANNEL: ChatChannel = { region: "global", shard: 0 };

/**
 * The CDN config in docs/CDN.md depends on these exact header values for the
 * cacheable read routes. This test pins them so a header change can't slip
 * past the edge without us noticing.
 */
describe("CDN-facing cache headers", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDb();
    await closeRedis();
  });

  beforeEach(async () => {
    await resetChat(getRedis(), CHANNEL);
  });

  it("GET /api/chat without auth → public, max-age=1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=global&shard=0",
    });
    expect(res.headers["cache-control"]).toBe("public, max-age=1");
  });

  it("GET /api/chat with auth header → private, max-age=1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=global&shard=0",
      headers: { "x-character-id": "someone" },
    });
    expect(res.headers["cache-control"]).toBe("private, max-age=1");
  });

  it("GET /api/market → public, max-age=2", async () => {
    const res = await app.inject({ method: "GET", url: "/api/market" });
    expect(res.headers["cache-control"]).toBe("public, max-age=2");
  });

  it("GET /spectate → public, max-age=60", async () => {
    const res = await app.inject({ method: "GET", url: "/spectate" });
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });
});
