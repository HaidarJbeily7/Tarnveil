import { describe, it, expect, beforeAll, afterAll } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { eq } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import type { ZoneState } from "../src/state.js";
import { CharacterStore } from "../src/CharacterStore.js";
import { closeDb, getDb } from "../src/db.js";

const ROOM = "mainland";
const settle = (ms = 200): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function startServer(): Promise<ColyseusTestServer> {
  const cfg = config({
    initializeGameServer: (gameServer: Server) => {
      gameServer.define(ROOM, ZoneRoom);
    },
  });
  const port = 30000 + Math.floor(Math.random() * 5000);
  return boot(cfg, port);
}

describe("Inventory persistence (R5 ledger)", () => {
  // Use a fresh name each run so reruns don't collide.
  const charName = `persistence-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    // Pre-warm a connection so the test can clean up afterwards.
    getDb();
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(characters).where(eq(characters.name, charName));
    await closeDb();
  });

  it("an item added before server restart is still present after restart", async () => {
    // --- First server lifetime: connect, give item, leave, shut down. ---
    let colyseus = await startServer();
    let room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client1 = await colyseus.connectTo(room, { characterName: charName });
    await room.waitForNextPatch();

    client1.send("debug-give-item", { kind: "wood", qty: 5 });
    await settle(250);

    await client1.leave();
    await settle(150);
    await colyseus.shutdown();
    await closeDb();

    // --- "Restart" — fresh boot, fresh DB pool, same character name. ---
    colyseus = await startServer();
    room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client2 = await colyseus.connectTo(room, { characterName: charName });
    await room.waitForNextPatch();

    // Read the inventory directly through a CharacterStore against the live DB.
    const db = getDb();
    const store = new CharacterStore(db);
    const character = await store.loadOrCreateByName(charName);
    const inv = await store.getInventory(character.id);
    expect(inv).toEqual([{ kind: "wood", qty: 5 }]);

    // R5: one ledger entry exists for the +5 wood mutation.
    const ledgerCount = await store.countLedgerEntries(character.id);
    expect(ledgerCount).toBe(1);

    await client2.leave();
    await colyseus.shutdown();
  });
});
