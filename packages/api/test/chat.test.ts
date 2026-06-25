import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../src/server.js";
import { appendChat, resetChat, type ChatChannel } from "../src/chat/log.js";
import { closeRedis, getRedis } from "../src/redis.js";

const CHANNEL: ChatChannel = { region: "global", shard: 0 };

describe("GET /api/chat", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeRedis();
  });

  beforeEach(async () => {
    await resetChat(getRedis(), CHANNEL);
  });

  it("returns only messages with id > after, in order, capped", async () => {
    const redis = getRedis();
    const seeded = [];
    for (let i = 0; i < 5; i++) {
      seeded.push(await appendChat(redis, CHANNEL, `u${i}`, `hello ${i}`));
    }
    expect(seeded.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);

    const res = await app.inject({
      method: "GET",
      url: "/api/chat?after=2&region=global&shard=0",
    });
    expect(res.statusCode).toBe(200);
    const { messages } = JSON.parse(res.body) as {
      messages: Array<{ id: number; body: string }>;
    };
    expect(messages.map((m) => m.id)).toEqual([3, 4, 5]);
    expect(messages.map((m) => m.body)).toEqual(["hello 2", "hello 3", "hello 4"]);
  });

  it("caps the response at the requested limit", async () => {
    const redis = getRedis();
    for (let i = 0; i < 12; i++) await appendChat(redis, CHANNEL, "u", `m${i}`);
    const res = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=global&shard=0&limit=3",
    });
    const { messages } = JSON.parse(res.body) as { messages: Array<{ id: number }> };
    expect(messages).toHaveLength(3);
    expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("returns the Cache-Control header for CDN fanout", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=global&shard=0",
    });
    expect(res.headers["cache-control"]).toBe("public, max-age=1");
  });

  it("isolates region/shard streams from each other", async () => {
    const redis = getRedis();
    const other: ChatChannel = { region: "eu", shard: 0 };
    await resetChat(redis, other);
    await appendChat(redis, CHANNEL, "u", "global-only");
    await appendChat(redis, other, "u", "eu-only");

    const r1 = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=global&shard=0",
    });
    const r2 = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=eu&shard=0",
    });
    const m1 = (JSON.parse(r1.body) as { messages: Array<{ body: string }> }).messages;
    const m2 = (JSON.parse(r2.body) as { messages: Array<{ body: string }> }).messages;
    expect(m1.map((m) => m.body)).toEqual(["global-only"]);
    expect(m2.map((m) => m.body)).toEqual(["eu-only"]);

    await resetChat(redis, other);
  });
});
