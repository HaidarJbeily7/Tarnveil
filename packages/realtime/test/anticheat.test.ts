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

const settle = (ms = 50): Promise<void> => new Promise((r) => setTimeout(r, ms));
const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("anti-cheat rate bounds", () => {
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

  it("synthetic 50 gathers/sec are rate-limited and bump cheatFlags", async () => {
    const name = uniqueName("antichop");
    const room = (await colyseus.createRoom("mainland", {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();

    // Teleport adjacent to tree-1 (5,5) and equip an axe.
    const player = (room.state as ZoneState).players.get(client.sessionId)!;
    const tree = ZONES.mainland!.resources.find((r) => r.id === "tree-1")!;
    player.col = tree.tile.col - 1;
    player.row = tree.tile.row;
    client.send("debug-give-item", { kind: "woodaxe", qty: 1 });
    await settle(150);

    const zoneRoom = room as unknown as { cheatFlags: number };
    const before = zoneRoom.cheatFlags;

    // Fire 50 gather attempts back to back; the rate guard kicks in fast.
    for (let i = 0; i < 50; i++) client.send("gather", { nodeId: tree.id });
    await settle(200);

    expect(zoneRoom.cheatFlags).toBeGreaterThan(before);

    // Inventory should have at most 1 wood (the legitimate first gather).
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    const inv = await store.getInventory(char.id);
    const wood = inv.find((i) => i.kind === "wood")?.qty ?? 0;
    expect(wood).toBeLessThanOrEqual(1);
  });
});
