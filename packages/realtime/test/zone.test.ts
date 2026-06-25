import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import type { ZoneState } from "../src/state.js";
import { closeDb, getDb } from "../src/db.js";

const ROOM = "zone";
const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("ZoneRoom", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const cfg = config({
      initializeGameServer: (gameServer: Server) => {
        gameServer.define(ROOM, ZoneRoom);
      },
    });
    // Bind to a fresh ephemeral port so reruns and stray prior processes
    // can't collide on the default 2568.
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

  it("adds the joining client to state and removes on leave", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    expect(room.state.players.size).toBe(0);

    const characterName = uniqueName("zone-join");
    const client = await colyseus.connectTo(room, { characterName });
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.has(client.sessionId)).toBe(true);

    await client.leave();
    await new Promise((r) => setTimeout(r, 100));
    expect(room.state.players.size).toBe(0);
  });

  it("spawns each client at the character's persisted position", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const characterName = uniqueName("zone-spawn");
    const client = await colyseus.connectTo(room, { characterName });
    await room.waitForNextPatch();
    const player = room.state.players.get(client.sessionId);
    expect(player).toBeDefined();
    // First join → fresh character with default spawn 1,1.
    expect(player?.col).toBe(1);
    expect(player?.row).toBe(1);
  });

  it("rejects a join without characterName", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    await expect(colyseus.connectTo(room, {})).rejects.toThrow();
  });

  // R7 reference: clean up any character row we used so reruns are deterministic.
  it("noop tail to keep afterAll cleanup in scope", () => {
    expect(createdNames.length).toBeGreaterThan(0);
  });
});
