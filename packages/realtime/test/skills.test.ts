import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { SKILL_LEVEL_CAP } from "@tarnveil/shared";
import { ZoneRoom } from "../src/ZoneRoom.js";
import type { ZoneState } from "../src/state.js";
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

describe("skills and XP", () => {
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

  it("a successful gather awards XP to the matching skill", async () => {
    const name = uniqueName("skill-gather");
    const room = (await colyseus.createRoom(ROOM, {})) as any;
    const client = (await colyseus.connectTo(room, { characterName: name })) as any;
    await room.waitForNextPatch();
    // Teleport adjacent to tree-1 (5,5) and equip an axe.
    const player = (room.state as ZoneState).players.get(client.sessionId)!;
    player.col = 4;
    player.row = 5;
    client.send("debug-give-item", { kind: "woodaxe", qty: 1 });
    await settle(150);

    client.send("gather", { nodeId: "tree-1" });
    await settle(250);

    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    const skills = await store.getSkills(char.id);
    expect(skills.woodcutting.xp).toBe(25);
    expect(skills.woodcutting.level).toBe(1);
    expect(skills.mining.xp).toBe(0);
  });

  it("level never exceeds SKILL_LEVEL_CAP even with huge XP", async () => {
    const name = uniqueName("skill-cap");
    const store = new CharacterStore(getDb());
    const char = await store.loadOrCreateByName(name);
    const out = await store.addXp(char.id, "combat", 9_999_999, "test-overflow");
    expect(out.level).toBe(SKILL_LEVEL_CAP);
    const skills = await store.getSkills(char.id);
    expect(skills.combat.level).toBe(SKILL_LEVEL_CAP);
  });

  it("XP and level survive a reload from the store", async () => {
    const name = uniqueName("skill-persist");
    const store1 = new CharacterStore(getDb());
    const char = await store1.loadOrCreateByName(name);
    await store1.addXp(char.id, "fishing", 350, "test");

    // New store handle to mimic a reload — it reads from the same DB.
    const store2 = new CharacterStore(getDb());
    const skills = await store2.getSkills(char.id);
    expect(skills.fishing.xp).toBe(350);
    expect(skills.fishing.level).toBe(4);
  });
});
