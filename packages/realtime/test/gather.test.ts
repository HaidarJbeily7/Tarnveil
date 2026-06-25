import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { ZoneRoom } from "../src/ZoneRoom.js";
import type { ZoneState } from "../src/state.js";
import { CharacterStore } from "../src/CharacterStore.js";
import { closeDb, getDb } from "../src/db.js";

const ROOM = "zone";
const settle = (ms = 150): Promise<void> => new Promise((r) => setTimeout(r, ms));

const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

describe("ZoneRoom gather", () => {
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

  // Returning `any` here keeps the helper tolerant of @colyseus/testing's
  // varying generic constraints across minor versions; the test bodies still
  // cast back to the shapes they actually use.
  async function setupNearTree(name: string): Promise<{
    room: any;
    client: any;
    charId: string;
  }> {
    const room = await colyseus.createRoom(ROOM, {}) as any;
    const client = await colyseus.connectTo(room, { characterName: name }) as any;
    await room.waitForNextPatch();
    const player = (room.state as ZoneState).players.get(client.sessionId)!;
    player.col = 4;
    player.row = 5;
    await settle(50);
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    return { room, client, charId: char.id };
  }

  it("rejects gather without the required tool", async () => {
    const name = uniqueName("gather-notool");
    const { room, client } = await setupNearTree(name);
    const zone = room as unknown as { lastGatherResult: ZoneRoom["lastGatherResult"] };

    client.send("gather", { nodeId: "tree-1" });
    await settle();
    expect(zone.lastGatherResult).toBe("missing-tool");

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    const inv = await store.getInventory(char.id);
    expect(inv.find((i) => i.kind === "wood")).toBeUndefined();
  });

  it("rejects gather out of range", async () => {
    const name = uniqueName("gather-range");
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client = await colyseus.connectTo(room, { characterName: name });
    await room.waitForNextPatch();
    // Player spawned at (1,1), tree at (5,5) — well out of range.
    client.send("debug-give-item", { kind: "woodaxe", qty: 1 });
    await settle(150);

    client.send("gather", { nodeId: "tree-1" });
    await settle();
    const zone = room as unknown as { lastGatherResult: ZoneRoom["lastGatherResult"] };
    expect(zone.lastGatherResult).toBe("out-of-range");
  });

  it("awards exactly one resource on success and rejects the next call until respawn", async () => {
    const name = uniqueName("gather-ok");
    const { room, client, charId } = await setupNearTree(name);
    const zone = room as unknown as { lastGatherResult: ZoneRoom["lastGatherResult"] };

    client.send("debug-give-item", { kind: "woodaxe", qty: 1 });
    await settle(150);

    client.send("gather", { nodeId: "tree-1" });
    await settle(200);
    expect(zone.lastGatherResult).toBe("ok");

    // Second immediate gather is on cooldown.
    client.send("gather", { nodeId: "tree-1" });
    await settle();
    expect(zone.lastGatherResult).toBe("cooldown");

    const store = new CharacterStore(getDb());
    const inv = await store.getInventory(charId);
    const wood = inv.find((i) => i.kind === "wood");
    expect(wood?.qty).toBe(1);
  });

  it("rejects gather on an unknown node", async () => {
    const name = uniqueName("gather-unknown");
    const { room, client } = await setupNearTree(name);
    const zone = room as unknown as { lastGatherResult: ZoneRoom["lastGatherResult"] };

    client.send("gather", { nodeId: "no-such-node" });
    await settle();
    expect(zone.lastGatherResult).toBe("no-node");
  });
});
