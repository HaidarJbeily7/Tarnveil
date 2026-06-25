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

const MERCHANT = ZONES.mainland!.merchants[0]!;

describe("NPC merchants", () => {
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

  async function joinAdjacent(name: string) {
    const room = (await colyseus.createRoom("mainland", {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();
    const player = (room.state as ZoneState).players.get(client.sessionId)!;
    // Stand next to the general store (2, 1).
    player.col = MERCHANT.tile.col;
    player.row = MERCHANT.tile.row + 1;
    return { room, client };
  }

  it("buying transfers gold and grants the item", async () => {
    const name = uniqueName("merch-buy");
    const { client } = await joinAdjacent(name);

    // Seed gold (server-side, no exposed debug for this).
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    await store.addGold(char.id, 100, "test-seed");

    const itemKind = "woodaxe";
    const price = MERCHANT.sells[itemKind]!;
    client.send("merchant-buy", { merchantId: MERCHANT.id, itemKind, qty: 1 });
    await settle(200);

    const after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(100 - price);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === itemKind)?.qty).toBe(1);
  });

  it("selling transfers the item and grants gold", async () => {
    const name = uniqueName("merch-sell");
    const { client } = await joinAdjacent(name);

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    await store.addItem(char.id, "wood", 5, "seed");

    const itemKind = "wood";
    const price = MERCHANT.buys[itemKind]!;
    client.send("merchant-sell", { merchantId: MERCHANT.id, itemKind, qty: 3 });
    await settle(200);

    const after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(3 * price);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === itemKind)?.qty).toBe(2);
  });

  it("insufficient gold rejects the buy and leaves state untouched", async () => {
    const name = uniqueName("merch-broke");
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    await expect(
      store.buyFromMerchant(char.id, "woodaxe", 1, 9999, "test"),
    ).rejects.toThrow();
    const after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(0);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === "woodaxe")).toBeUndefined();
  });

  it("insufficient items rejects the sell and leaves state untouched", async () => {
    const name = uniqueName("merch-empty");
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    await expect(
      store.sellToMerchant(char.id, "wood", 5, 5, "test"),
    ).rejects.toThrow();
    const after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(0);
  });
});
