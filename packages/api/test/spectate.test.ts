import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../src/server.js";
import { appendChat, resetChat, type ChatChannel } from "../src/chat/log.js";
import { closeRedis, getRedis } from "../src/redis.js";

const CHANNEL: ChatChannel = { region: "global", shard: 0 };

describe("spectate mode (no session)", () => {
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

  it("serves /spectate as plain HTML without any auth", async () => {
    const res = await app.inject({ method: "GET", url: "/spectate" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    // The page references the chat endpoint and has a feed container.
    expect(res.body).toContain("/api/chat");
    expect(res.body).toContain('data-test-id="spectate-feed"');
  });

  it("GET /api/chat without auth returns recent messages", async () => {
    await appendChat(getRedis(), CHANNEL, "alice", "hello world");
    await appendChat(getRedis(), CHANNEL, "bob", "hi");
    const res = await app.inject({
      method: "GET",
      url: "/api/chat?after=0&region=global&shard=0",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=1");
    const { messages } = JSON.parse(res.body) as {
      messages: Array<{ author: string; body: string }>;
    };
    expect(messages.map((m) => m.body)).toEqual(["hello world", "hi"]);
  });
});
