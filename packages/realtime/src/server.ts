import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME } from "@tarnveil/shared/game.config";
import { ZoneRoom } from "./ZoneRoom.js";

const port = Number(process.env.REALTIME_PORT ?? 2567);
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

const roomName = `${GAME.slug}-zone`;
gameServer.define(roomName, ZoneRoom);

gameServer.listen(port).then(() => {
  console.log(`[realtime] ${GAME.slug} listening on :${port}, room=${roomName}`);
});
