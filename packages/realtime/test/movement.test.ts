import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { ZoneRoom } from "../src/ZoneRoom.js";
import type { ZoneState } from "../src/state.js";

const ROOM = "zone";
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 100));

describe("ZoneRoom movement", () => {
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
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("accepts a valid adjacent move and updates state", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    client.send("move-to", { col: 2, row: 1 });
    await settle();

    const me = room.state.players.get(client.sessionId);
    expect(me?.col).toBe(2);
    expect(me?.row).toBe(1);
  });

  it("rejects a move onto a blocked tile", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    // (3,3) is part of the seeded wall.
    client.send("move-to", { col: 3, row: 3 });
    await settle();

    const me = room.state.players.get(client.sessionId);
    expect(me?.col).toBe(1);
    expect(me?.row).toBe(1);
  });

  it("rejects an unreachable (out-of-bounds) move", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    client.send("move-to", { col: 99, row: 99 });
    await settle();

    const me = room.state.players.get(client.sessionId);
    expect(me?.col).toBe(1);
    expect(me?.row).toBe(1);
  });

  it("rejects a malformed payload", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    client.send("move-to", { col: "no", row: null });
    await settle();

    const me = room.state.players.get(client.sessionId);
    expect(me?.col).toBe(1);
    expect(me?.row).toBe(1);
  });
});
