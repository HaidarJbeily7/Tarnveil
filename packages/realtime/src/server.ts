import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME } from "@tarnveil/shared/game.config";
import { ZoneRoom } from "./ZoneRoom.js";
import { ZONE_IDS } from "./zones.js";

const port = Number(process.env.REALTIME_PORT ?? 2567);
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

for (const zoneId of ZONE_IDS) {
  gameServer.define(zoneId, ZoneRoom);
}

gameServer.listen(port).then(() => {
  console.log(
    `[realtime] ${GAME.slug} listening on :${port}, zones=[${ZONE_IDS.join(", ")}]`,
  );
});
