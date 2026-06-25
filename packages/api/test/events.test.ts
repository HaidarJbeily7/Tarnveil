import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../src/server.js";
import { closeRedis, getRedis } from "../src/redis.js";
import { closeDb } from "../src/db.js";

describe("live-ops event toggles", () => {
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
    await getRedis().del("liveops:active");
  });

  it("lists known events, enables one, disables it — all without a redeploy", async () => {
    const before = await app.inject({ method: "GET", url: "/api/admin/events" });
    const beforeBody = JSON.parse(before.body) as {
      events: Array<{ id: string; active: boolean }>;
    };
    expect(beforeBody.events.find((e) => e.id === "double-xp")?.active).toBe(false);

    const enable = await app.inject({
      method: "POST",
      url: "/api/admin/events/double-xp/enable",
    });
    expect(enable.statusCode).toBe(200);

    const mid = await app.inject({ method: "GET", url: "/api/admin/events" });
    expect(
      (JSON.parse(mid.body).events as Array<{ id: string; active: boolean }>)
        .find((e) => e.id === "double-xp")?.active,
    ).toBe(true);

    const disable = await app.inject({
      method: "POST",
      url: "/api/admin/events/double-xp/disable",
    });
    expect(disable.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/admin/events" });
    expect(
      (JSON.parse(after.body).events as Array<{ id: string; active: boolean }>)
        .find((e) => e.id === "double-xp")?.active,
    ).toBe(false);
  });

  it("unknown event id returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/events/no-such-event/enable",
    });
    expect(res.statusCode).toBe(404);
  });
});
