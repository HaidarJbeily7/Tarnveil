import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import { ZONES } from "../src/zones.js";
import type { ZoneState } from "../src/state.js";

const MAINLAND_MOBS = ZONES.mainland.mobs;
import { CharacterStore } from "../src/CharacterStore.js";
import { closeDb, getDb } from "../src/db.js";

const ROOM = "mainland";
const settle = (ms = 200): Promise<void> => new Promise((r) => setTimeout(r, ms));
const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("ZoneRoom combat", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const cfg = config({
      initializeGameServer: (gameServer: Server) => {
        gameServer.define(ROOM, ZoneRoom);
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

  async function joinAndPlace(name: string, col: number, row: number) {
    const room = (await colyseus.createRoom(ROOM, {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();
    const player = (room.state as ZoneState).players.get(client.sessionId)!;
    player.col = col;
    player.row = row;
    // Avoid the simulation tick smashing us — first verify mob is at its spawn
    // (7,7) and then we approach. With aggroRange = 3, parking at (4,4) keeps
    // us out of aggro so we control timing.
    return { room, client };
  }

  it("rejects an attack out of range", async () => {
    const name = uniqueName("combat-range");
    const { room, client } = await joinAndPlace(name, 1, 1);
    client.send("attack", { mobId: "wolf-1" });
    await settle();
    const zone = room as unknown as { lastAttackResult: ZoneRoom["lastAttackResult"] };
    expect(zone.lastAttackResult).toBe("out-of-range");
    const wolf = MAINLAND_MOBS[0]!;
    const mob = (room.state as ZoneState).mobs.get(wolf.id);
    expect(mob?.hp).toBe(wolf.hpMax);
  });

  it("client-claimed damage is ignored; the server applies PLAYER_BASE_DAMAGE", async () => {
    const name = uniqueName("combat-tamper");
    const { room, client } = await joinAndPlace(name, 7, 6); // adjacent to wolf (7,7)
    client.send("attack", { mobId: "wolf-1", damage: 9999 }); // claim huge dmg
    await settle();
    const wolf = MAINLAND_MOBS[0]!;
    const mob = (room.state as ZoneState).mobs.get(wolf.id);
    // Only one hit's worth gone — the client's damage field was discarded.
    expect(mob?.hp).toBe(wolf.hpMax - 1);
  });

  it("killing a mob yields its drop in inventory and despawns the mob", async () => {
    const name = uniqueName("combat-kill");
    const { room, client } = await joinAndPlace(name, 7, 6);
    const wolf = MAINLAND_MOBS[0]!;
    // 3 HP, 1 dmg per hit — three attacks to kill.
    for (let i = 0; i < wolf.hpMax; i++) {
      client.send("attack", { mobId: wolf.id });
      await settle(120);
    }
    const mob = (room.state as ZoneState).mobs.get(wolf.id);
    expect(mob).toBeUndefined();

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === wolf.drop.kind)?.qty).toBe(wolf.drop.qty);
  });
});
