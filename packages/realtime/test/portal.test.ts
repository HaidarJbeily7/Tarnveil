import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import { ZONE_IDS, ZONES } from "../src/zones.js";
import type { ZoneState } from "../src/state.js";
import { CharacterStore } from "../src/CharacterStore.js";
import { closeDb, getDb } from "../src/db.js";

const settle = (ms = 200): Promise<void> => new Promise((r) => setTimeout(r, ms));
const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("portal / zone handoff", () => {
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

  it("stepping on a portal moves the player to the target zone with state intact", async () => {
    const name = uniqueName("portal");
    const mainland = (await colyseus.createRoom("mainland", {})) as any;
    const gathering = (await colyseus.createRoom("gathering", {})) as any;

    // 1) Connect to mainland and seed inventory.
    const client = (await colyseus.connectTo(mainland, { characterName: name })) as any;
    await mainland.waitForNextPatch();
    client.send("debug-give-item", { kind: "wood", qty: 7 });
    await settle(200);

    // 2) Walk the player onto the mainland → gathering portal at (9, 9).
    const player = (mainland.state as ZoneState).players.get(client.sessionId)!;
    player.col = 8;
    player.row = 9;
    client.send("move-to", { col: 9, row: 9 });
    await settle(300);

    // After handoff: mainland no longer has the player; DB has the new
    // zone+coords; inventory is unchanged.
    expect((mainland.state as ZoneState).players.has(client.sessionId)).toBe(false);

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    expect(char.zone).toBe("gathering");
    const portal = ZONES.mainland.portals.find((p) => p.targetZone === "gathering")!;
    expect(char.col).toBe(portal.spawnAt.col);
    expect(char.row).toBe(portal.spawnAt.row);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === "wood")?.qty).toBe(7);

    // 3) Re-join the target room with the same character name; the player
    //    spawns at the portal's spawnAt and still has 7 wood (the DB read).
    const client2 = (await colyseus.connectTo(gathering, { characterName: name })) as any;
    await gathering.waitForNextPatch();
    const reborn = (gathering.state as ZoneState).players.get(client2.sessionId)!;
    expect(reborn.col).toBe(portal.spawnAt.col);
    expect(reborn.row).toBe(portal.spawnAt.row);
    const inv2 = await store.getInventory(char.id);
    expect(inv2.find((i) => i.kind === "wood")?.qty).toBe(7);
  });
});
