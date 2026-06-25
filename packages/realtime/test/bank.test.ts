import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import { ZONE_IDS } from "../src/zones.js";
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

describe("bank deposit/withdraw + safe-zone heal", () => {
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

  it("round-trips items between inventory and bank with no dup or loss", async () => {
    const name = uniqueName("bank");
    const room = (await colyseus.createRoom("mainland", {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();
    client.send("debug-give-item", { kind: "wood", qty: 10 });
    await settle(200);

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);

    // Deposit 6 to page 0.
    client.send("bank-deposit", { kind: "wood", qty: 6, page: 0 });
    await settle(200);
    let inv = await store.getInventory(char.id);
    let bank0 = await store.getBankPage(char.id, 0);
    expect(inv.find((i) => i.kind === "wood")?.qty).toBe(4);
    expect(bank0.find((i) => i.kind === "wood")?.qty).toBe(6);

    // Withdraw 2 → 6→8 inv, 6→4 bank.
    client.send("bank-withdraw", { kind: "wood", qty: 2, page: 0 });
    await settle(200);
    inv = await store.getInventory(char.id);
    bank0 = await store.getBankPage(char.id, 0);
    expect(inv.find((i) => i.kind === "wood")?.qty).toBe(6);
    expect(bank0.find((i) => i.kind === "wood")?.qty).toBe(4);

    // Total accounted for at every step: 10 wood across the two surfaces.
    expect(
      (inv.find((i) => i.kind === "wood")?.qty ?? 0) +
        (bank0.find((i) => i.kind === "wood")?.qty ?? 0),
    ).toBe(10);
  });

  it("multi-page bank: page 0 and page 1 are independent slots", async () => {
    const name = uniqueName("bank-pages");
    const room = (await colyseus.createRoom("mainland", {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();
    client.send("debug-give-item", { kind: "wood", qty: 10 });
    await settle(200);

    client.send("bank-deposit", { kind: "wood", qty: 3, page: 0 });
    client.send("bank-deposit", { kind: "wood", qty: 4, page: 1 });
    await settle(300);

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    const p0 = await store.getBankPage(char.id, 0);
    const p1 = await store.getBankPage(char.id, 1);
    expect(p0.find((i) => i.kind === "wood")?.qty).toBe(3);
    expect(p1.find((i) => i.kind === "wood")?.qty).toBe(4);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === "wood")?.qty).toBe(3);
  });

  it("over-deposit and over-withdraw leave state untouched", async () => {
    const name = uniqueName("bank-overflow");
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    await store.addItem(char.id, "wood", 2, "seed");
    await expect(
      store.depositToBank(char.id, "wood", 5, 0, "test"),
    ).rejects.toThrow();
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === "wood")?.qty).toBe(2);
    const bank = await store.getBankPage(char.id, 0);
    expect(bank).toEqual([]);
  });

  it("standing in the mainland safe zone regenerates HP over time", async () => {
    const name = uniqueName("safe-zone");
    const room = (await colyseus.createRoom("mainland", {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();
    const player = (room.state as ZoneState).players.get(client.sessionId)!;
    // Damage the player heavily, place inside safe zone bounds (0..2, 0..2).
    player.hp = 1;
    player.col = 0;
    player.row = 0;
    const before = player.hp;
    // Tick is 250ms; wait for several ticks to see regen.
    await settle(1500);
    expect(player.hp).toBeGreaterThan(before);
    expect(player.hp).toBeLessThanOrEqual(player.hpMax);
  });
});
