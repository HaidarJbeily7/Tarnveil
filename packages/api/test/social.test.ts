import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { characters, friends } from "@tarnveil/shared/db";
import { buildApp } from "../src/server.js";
import { closeDb, getDb } from "../src/db.js";
import { closeRedis, getRedis } from "../src/redis.js";
import { clearPresence, setPresence } from "../src/presence.js";

const createdNames: string[] = [];
const createdIds: string[] = [];

async function makeChar(name: string): Promise<string> {
  const db = getDb();
  createdNames.push(name);
  const [row] = await db.insert(characters).values({ name }).returning();
  if (!row) throw new Error("character insert failed");
  createdIds.push(row.id);
  return row.id;
}

describe("social: friends, presence, DMs", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    const db = getDb();
    if (createdIds.length > 0) {
      await db.delete(friends).where(inArray(friends.requesterId, createdIds));
    }
    if (createdNames.length > 0) {
      await db.delete(characters).where(inArray(characters.name, createdNames));
    }
    await closeDb();
    await closeRedis();
  });

  it("a friend request requires acceptance before it shows as accepted", async () => {
    const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const aliceId = await makeChar(`alice-${stamp}`);
    const bobId = await makeChar(`bob-${stamp}`);

    const req = await app.inject({
      method: "POST",
      url: "/api/friends/request",
      headers: { "x-character-id": aliceId },
      payload: { target: bobId },
    });
    expect(req.statusCode).toBe(200);

    // Before bob accepts, the row is pending.
    let listAlice = await app.inject({
      method: "GET",
      url: "/api/friends",
      headers: { "x-character-id": aliceId },
    });
    const aliceFriends = JSON.parse(listAlice.body).friends as Array<{ status: string }>;
    expect(aliceFriends).toHaveLength(1);
    expect(aliceFriends[0]?.status).toBe("pending");

    // Bob accepts.
    const acc = await app.inject({
      method: "POST",
      url: "/api/friends/accept",
      headers: { "x-character-id": bobId },
      payload: { from: aliceId },
    });
    expect(acc.statusCode).toBe(200);

    // Both see it as accepted now.
    listAlice = await app.inject({
      method: "GET",
      url: "/api/friends",
      headers: { "x-character-id": aliceId },
    });
    const listBob = await app.inject({
      method: "GET",
      url: "/api/friends",
      headers: { "x-character-id": bobId },
    });
    expect((JSON.parse(listAlice.body).friends[0] as { status: string }).status).toBe("accepted");
    expect((JSON.parse(listBob.body).friends[0] as { status: string }).status).toBe("accepted");

    // Acceptance is a no-op if no pending request exists.
    const dupe = await app.inject({
      method: "POST",
      url: "/api/friends/accept",
      headers: { "x-character-id": bobId },
      payload: { from: aliceId },
    });
    expect(dupe.statusCode).toBe(404);
  });

  it("presence reports the correct online zone", async () => {
    const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const id = await makeChar(`presence-${stamp}`);
    const redis = getRedis();

    // Not yet set → offline.
    let res = await app.inject({ method: "GET", url: `/api/presence/${id}` });
    expect(JSON.parse(res.body)).toEqual({ characterId: id, zone: null, online: false });

    await setPresence(redis, id, "mainland");
    res = await app.inject({ method: "GET", url: `/api/presence/${id}` });
    expect(JSON.parse(res.body)).toEqual({ characterId: id, zone: "mainland", online: true });

    await setPresence(redis, id, "gathering");
    res = await app.inject({ method: "GET", url: `/api/presence/${id}` });
    expect(JSON.parse(res.body)).toEqual({ characterId: id, zone: "gathering", online: true });

    await clearPresence(redis, id);
    res = await app.inject({ method: "GET", url: `/api/presence/${id}` });
    expect(JSON.parse(res.body)).toEqual({ characterId: id, zone: null, online: false });
  });

  it("DMs deliver only to the pair", async () => {
    const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const aliceId = await makeChar(`dm-alice-${stamp}`);
    const bobId = await makeChar(`dm-bob-${stamp}`);
    const carolId = await makeChar(`dm-carol-${stamp}`);

    const sent = await app.inject({
      method: "POST",
      url: `/api/dm/${bobId}`,
      headers: { "x-character-id": aliceId },
      payload: { body: "hi bob" },
    });
    expect(sent.statusCode).toBe(201);

    const aliceView = await app.inject({
      method: "GET",
      url: `/api/dm/${bobId}?after=0`,
      headers: { "x-character-id": aliceId },
    });
    const bobView = await app.inject({
      method: "GET",
      url: `/api/dm/${aliceId}?after=0`,
      headers: { "x-character-id": bobId },
    });
    expect((JSON.parse(aliceView.body).messages as Array<{ body: string }>).map((m) => m.body))
      .toEqual(["hi bob"]);
    expect((JSON.parse(bobView.body).messages as Array<{ body: string }>).map((m) => m.body))
      .toEqual(["hi bob"]);

    // Carol queries her conversation with alice — it has nothing in it.
    const carolView = await app.inject({
      method: "GET",
      url: `/api/dm/${aliceId}?after=0`,
      headers: { "x-character-id": carolId },
    });
    expect(JSON.parse(carolView.body).messages).toEqual([]);
  });
});
