import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/server.js";
import { closeDb } from "../src/db.js";
import { closeRedis } from "../src/redis.js";

describe("admin metrics", () => {
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

  it("reports uptime, character/listing counts, and per-route request counts", async () => {
    // Hit health a few times to seed the counter.
    for (let i = 0; i < 3; i++) await app.inject({ method: "GET", url: "/health" });

    const res = await app.inject({ method: "GET", url: "/api/admin/metrics" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      uptimeMs: number;
      characters: number;
      activeListings: number;
      requests: Record<string, number>;
      errors: Record<string, number>;
    };
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(body.characters).toBeGreaterThanOrEqual(0);
    expect(body.requests["GET /health"]).toBeGreaterThanOrEqual(3);
  });
});
