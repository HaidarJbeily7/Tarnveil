import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import config from "@colyseus/tools";
import { Server } from "colyseus";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { ZoneRoom } from "../src/ZoneRoom.js";
import type { ZoneState } from "../src/state.js";

const ROOM = "zone";

describe("ZoneRoom", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const cfg = config({
      initializeGameServer: (gameServer: Server) => {
        gameServer.define(ROOM, ZoneRoom);
      },
    });
    // Bind to a fresh ephemeral port so reruns and stray prior processes
    // can't collide on the default 2568.
    const port = 30000 + Math.floor(Math.random() * 5000);
    colyseus = await boot(cfg, port);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("adds the joining client to state and removes on leave", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    expect(room.state.players.size).toBe(0);

    const client = await colyseus.connectTo(room);
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.has(client.sessionId)).toBe(true);

    await client.leave();
    // Give Colyseus a tick to run onLeave; the room is autoDispose=false so it stays.
    await new Promise((r) => setTimeout(r, 100));
    expect(room.state.players.size).toBe(0);
  });

  it("spawns each client at the zone's spawn point", async () => {
    const room = await colyseus.createRoom<ZoneState>(ROOM, {});
    const client = await colyseus.connectTo(room);
    await room.waitForNextPatch();
    const player = room.state.players.get(client.sessionId);
    expect(player).toBeDefined();
    expect(player?.col).toBe(1);
    expect(player?.row).toBe(1);
  });
});
