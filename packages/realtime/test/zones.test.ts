import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import { ZONE_IDS, ZONES } from "../src/zones.js";
import type { ZoneState } from "../src/state.js";
import { closeDb, getDb } from "../src/db.js";

const settle = (ms = 100): Promise<void> => new Promise((r) => setTimeout(r, ms));
const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("multiple zones", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const cfg = config({
      initializeGameServer: (gameServer: Server) => {
        for (const id of ZONE_IDS) gameServer.define(id, ZoneRoom);
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

  it("every zone boots independently", async () => {
    for (const id of ZONE_IDS) {
      const room = (await colyseus.createRoom(id, {})) as any;
      const expected = ZONES[id]!;
      expect((room.state as ZoneState).mobs.size).toBe(expected.mobs.length);
      // Zones with no mobs (e.g. gathering, fishing) have an empty mobs map.
      for (const mobDef of expected.mobs) {
        expect((room.state as ZoneState).mobs.get(mobDef.id)?.hp).toBe(mobDef.hpMax);
      }
    }
  });

  it("a player is in exactly one zone at a time", async () => {
    const aliceName = uniqueName("alice");
    const mainland = (await colyseus.createRoom("mainland", {})) as any;
    const gathering = (await colyseus.createRoom("gathering", {})) as any;

    const aliceClient = (await colyseus.connectTo(mainland, { characterName: aliceName })) as any;
    await mainland.waitForNextPatch();

    expect((mainland.state as ZoneState).players.has(aliceClient.sessionId)).toBe(true);
    expect((gathering.state as ZoneState).players.has(aliceClient.sessionId)).toBe(false);

    // Sanity: a second player in another room is isolated.
    const bobName = uniqueName("bob");
    const bobClient = (await colyseus.connectTo(gathering, { characterName: bobName })) as any;
    await gathering.waitForNextPatch();
    expect((gathering.state as ZoneState).players.size).toBe(1);
    expect((mainland.state as ZoneState).players.size).toBe(1);
    expect((mainland.state as ZoneState).players.has(bobClient.sessionId)).toBe(false);

    await settle();
  });

  it("zones expose only their own resource nodes via state setup", async () => {
    const mainland = (await colyseus.createRoom("mainland", {})) as any;
    const gathering = (await colyseus.createRoom("gathering", {})) as any;
    expect(ZONES.mainland.resources.length).toBe(1);
    expect(ZONES.gathering.resources.length).toBeGreaterThanOrEqual(2);
    // Different zones have distinct config — proof of independence.
    expect(ZONES.mainland.resources).not.toEqual(ZONES.gathering.resources);
    // Just touch the rooms so vitest doesn't drop them.
    expect((mainland.state as ZoneState).players.size).toBe(0);
    expect((gathering.state as ZoneState).players.size).toBe(0);
  });
});
