import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray, sql } from "drizzle-orm";
import { characters, ledger } from "@tarnveil/shared/db";
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

describe("full relog persistence", () => {
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

  it("logging out and back in restores position, inventory, bank, skills, and gold exactly", async () => {
    const name = uniqueName("relog");

    // --- First session: build up some state across all surfaces. ---
    let room = (await colyseus.createRoom("mainland", {})) as any;
    let client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);

    // Inventory
    client.send("debug-give-item", { kind: "wood", qty: 7 });
    client.send("debug-give-item", { kind: "woodaxe", qty: 1 });
    await settle(200);

    // Bank
    client.send("bank-deposit", { kind: "wood", qty: 3, page: 0 });
    await settle(200);

    // Skills + gold are driven directly through the store (no exposed
    // debug message for these — server actions normally produce them).
    await store.addXp(char.id, "fishing", 150, "test-setup");
    await store.addGold(char.id, 42, "test-setup");

    // Position
    const player1 = (room.state as ZoneState).players.get(client.sessionId)!;
    player1.col = 4;
    player1.row = 6;

    await client.leave();
    // Give onLeave a tick to persist position.
    await settle(150);

    // Snapshot the DB-side truth before re-joining.
    const charBefore = await store.loadOrCreateByName(name);
    const invBefore = await store.getInventory(char.id);
    const bankBefore = await store.getBankPage(char.id, 0);
    const skillsBefore = await store.getSkills(char.id);

    // --- Second session: re-join and confirm state matches. ---
    room = (await colyseus.createRoom("mainland", {})) as any;
    client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();

    const player2 = (room.state as ZoneState).players.get(client.sessionId)!;
    // Position survived.
    expect(player2.col).toBe(charBefore.col);
    expect(player2.row).toBe(charBefore.row);
    expect(player2.col).toBe(4);
    expect(player2.row).toBe(6);

    // Inventory survived: 7 wood started, 3 deposited → 4 remaining; 1 axe.
    const invAfter = await store.getInventory(char.id);
    expect(invAfter).toEqual(invBefore);
    expect(invAfter.find((i) => i.kind === "wood")?.qty).toBe(4);
    expect(invAfter.find((i) => i.kind === "woodaxe")?.qty).toBe(1);

    // Bank survived: 3 wood on page 0.
    const bankAfter = await store.getBankPage(char.id, 0);
    expect(bankAfter).toEqual(bankBefore);
    expect(bankAfter.find((i) => i.kind === "wood")?.qty).toBe(3);

    // Skills survived: fishing 150 xp → level 2.
    const skillsAfter = await store.getSkills(char.id);
    expect(skillsAfter.fishing).toEqual(skillsBefore.fishing);
    expect(skillsAfter.fishing.xp).toBe(150);
    expect(skillsAfter.fishing.level).toBe(2);

    // Gold survived.
    const charAfter = await store.loadOrCreateByName(name);
    expect(charAfter.gold).toBe(charBefore.gold);
    expect(charAfter.gold).toBe(42);
  });

  it("ledger sums to the live gold balance (R5 cross-check)", async () => {
    const name = uniqueName("relog-ledger");
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    await store.addGold(char.id, 10, "a");
    await store.addGold(char.id, 25, "b");
    await store.addGold(char.id, -7, "c");
    const after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(28);

    const db = getDb();
    const [{ sum }] = await db
      .select({ sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::int` })
      .from(ledger)
      .where(sql`${ledger.characterId} = ${char.id} AND ${ledger.kind} = 'gold'`);
    expect(Number(sum)).toBe(28);
  });
});
