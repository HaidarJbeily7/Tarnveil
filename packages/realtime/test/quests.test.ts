import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { inArray } from "drizzle-orm";
import { characters } from "@tarnveil/shared/db";
import { DAILY_QUESTS } from "@tarnveil/shared";
import { ZoneRoom } from "../src/ZoneRoom.js";
import { ZONE_IDS } from "../src/zones.js";
import { CharacterStore } from "../src/CharacterStore.js";
import { closeDb, getDb } from "../src/db.js";

const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const n = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdNames.push(n);
  return n;
}

const WOOD_QUEST = DAILY_QUESTS.find((q) => q.id === "daily-wood-3")!;

describe("daily quests", () => {
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

  it("bumps progress and pays exactly once on completion", async () => {
    const store = new CharacterStore(getDb());
    const name = uniqueName("quest-once");
    const char = await store.loadOrCreateByName(name);

    const r1 = await store.bumpQuestProgress(char.id, WOOD_QUEST.id, 1);
    expect(r1).toEqual({ progress: 1, target: 3, completed: false, paid: false });
    const r2 = await store.bumpQuestProgress(char.id, WOOD_QUEST.id, 1);
    expect(r2.progress).toBe(2);
    expect(r2.paid).toBe(false);
    const r3 = await store.bumpQuestProgress(char.id, WOOD_QUEST.id, 1);
    expect(r3).toEqual({ progress: 3, target: 3, completed: true, paid: true });

    // Reward applied.
    const after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(WOOD_QUEST.rewardGold);
    const skills = await store.getSkills(char.id);
    expect(skills[WOOD_QUEST.rewardSkill].xp).toBe(WOOD_QUEST.rewardXp);

    // Further bumps do nothing — quest already completed for today.
    const r4 = await store.bumpQuestProgress(char.id, WOOD_QUEST.id, 1);
    expect(r4.paid).toBe(false);
    expect(r4.completed).toBe(true);
    const stillAfter = await store.loadOrCreateByName(name);
    expect(stillAfter.gold).toBe(WOOD_QUEST.rewardGold);
  });

  it("resets after the 24h window and pays again on next completion", async () => {
    const store = new CharacterStore(getDb());
    const name = uniqueName("quest-reset");
    const char = await store.loadOrCreateByName(name);

    for (let i = 0; i < 3; i++) await store.bumpQuestProgress(char.id, WOOD_QUEST.id, 1);
    let after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(WOOD_QUEST.rewardGold);

    // Force reset and complete again.
    await store.testForceResetQuest(char.id, WOOD_QUEST.id);
    const r = await store.bumpQuestProgress(char.id, WOOD_QUEST.id, 3);
    expect(r).toEqual({ progress: 3, target: 3, completed: true, paid: true });
    after = await store.loadOrCreateByName(name);
    expect(after.gold).toBe(WOOD_QUEST.rewardGold * 2);
  });
});
