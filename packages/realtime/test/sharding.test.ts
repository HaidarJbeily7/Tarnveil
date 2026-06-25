import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import { ZONE_IDS } from "../src/zones.js";
import type { ZoneState } from "../src/state.js";
import { closeDb, getDb } from "../src/db.js";

const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("zone sharding", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const cfg = config({
      initializeGameServer: (gameServer: Server) => {
        for (const id of ZONE_IDS) {
          gameServer.define(id, ZoneRoom).filterBy(["shard"]);
        }
      },
    });
    const port = 30000 + Math.floor(Math.random() * 5000);
    colyseus = await boot(cfg, port);
  });

  afterAll(async () => {
    await colyseus.shutdown();
    if (createdNames.length > 0) {
      const db = getDb();
      await db.delete(characters).where(inArray(characters.name, createdNames));
    }
    await closeDb();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("two rooms created with different shards keep their state isolated", async () => {
    const room0 = (await colyseus.createRoom("mainland", { shard: 0 })) as any;
    const room1 = (await colyseus.createRoom("mainland", { shard: 1 })) as any;
    expect((room0.state as ZoneState).shard).toBe(0);
    expect((room1.state as ZoneState).shard).toBe(1);

    const alice = (await colyseus.connectTo(room0, {
      characterName: uniqueName("shard0"),
    })) as any;
    const bob = (await colyseus.connectTo(room1, {
      characterName: uniqueName("shard1"),
    })) as any;
    await room0.waitForNextPatch();
    await room1.waitForNextPatch();

    // Each shard sees only its own player.
    expect((room0.state as ZoneState).players.has(alice.sessionId)).toBe(true);
    expect((room0.state as ZoneState).players.has(bob.sessionId)).toBe(false);
    expect((room1.state as ZoneState).players.has(bob.sessionId)).toBe(true);
    expect((room1.state as ZoneState).players.has(alice.sessionId)).toBe(false);
  });
});
