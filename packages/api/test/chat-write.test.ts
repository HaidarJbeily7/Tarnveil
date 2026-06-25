import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../src/server.js";
import { resetChat, type ChatChannel } from "../src/chat/log.js";
import {
  CHAT_MAX_BODY,
  CHAT_RATE_LIMIT,
  unmute,
} from "../src/chat/moderation.js";
import { closeRedis, getRedis } from "../src/redis.js";

const CHANNEL: ChatChannel = { region: "global", shard: 0 };

async function clearRate(authorId: string): Promise<void> {
  await getRedis().del(`chat:rate:${authorId}`);
}

describe("POST /api/chat with moderation", () => {
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
    await clearRate("alice");
    await clearRate("bob");
    await clearRate("carol");
    await unmute(getRedis(), "bob", "alice");
  });

  it("rejects an unauthenticated post", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { region: CHANNEL.region, shard: CHANNEL.shard, body: "hi" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an over-length body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "x-character-id": "alice" },
      payload: {
        region: CHANNEL.region,
        shard: CHANNEL.shard,
        body: "x".repeat(CHAT_MAX_BODY + 1),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("too-long");
  });

  it("rejects messages over the rate limit", async () => {
    for (let i = 0; i < CHAT_RATE_LIMIT; i++) {
      const ok = await app.inject({
        method: "POST",
        url: "/api/chat",
        headers: { "x-character-id": "alice" },
        payload: { region: CHANNEL.region, shard: CHANNEL.shard, body: `m${i}` },
      });
      expect(ok.statusCode).toBe(201);
    }
    const over = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "x-character-id": "alice" },
      payload: { region: CHANNEL.region, shard: CHANNEL.shard, body: "too many" },
    });
    expect(over.statusCode).toBe(429);
  });

  it("hides a muted author's messages from the muter only", async () => {
    // alice posts in the open
    await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "x-character-id": "alice" },
      payload: { region: CHANNEL.region, shard: CHANNEL.shard, body: "from alice" },
    });

    // bob mutes alice
    const muteRes = await app.inject({
      method: "POST",
      url: "/api/mute",
      headers: { "x-character-id": "bob" },
      payload: { target: "alice" },
    });
    expect(muteRes.statusCode).toBe(200);

    // bob's read drops alice's message; carol still sees it.
    const bobRead = await app.inject({
      method: "GET",
      url: `/api/chat?after=0&region=${CHANNEL.region}&shard=${CHANNEL.shard}`,
      headers: { "x-character-id": "bob" },
    });
    const carolRead = await app.inject({
      method: "GET",
      url: `/api/chat?after=0&region=${CHANNEL.region}&shard=${CHANNEL.shard}`,
      headers: { "x-character-id": "carol" },
    });
    const bobMsgs = JSON.parse(bobRead.body).messages as Array<{ author: string }>;
    const carolMsgs = JSON.parse(carolRead.body).messages as Array<{ author: string }>;
    expect(bobMsgs.find((m) => m.author === "alice")).toBeUndefined();
    expect(carolMsgs.find((m) => m.author === "alice")).toBeDefined();
  });
});
