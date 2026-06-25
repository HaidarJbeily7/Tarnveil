import "dotenv/config";
import Fastify from "fastify";
import { GAME } from "@tarnveil/shared/game.config";
import { getRedis } from "./redis.js";
import { getDb } from "./db.js";
import { bumpErrorCount, bumpRequestCount, registerAdminRoutes } from "./routes/admin.js";
import { registerCharacterRoutes } from "./routes/character.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerCosmeticRoute } from "./routes/cosmetic.js";
import { registerDmRoutes } from "./routes/dm.js";
import { registerEventsRoutes } from "./routes/events.js";
import { registerFriendsRoutes } from "./routes/friends.js";
import { registerMarketRoutes } from "./routes/market.js";
import { registerPresenceRoute } from "./routes/presence.js";
import { registerSpectateRoute } from "./routes/spectate.js";

export function buildApp(): ReturnType<typeof Fastify> {
  const app = Fastify({ logger: false });
  const redis = getRedis();

  app.addHook("onResponse", async (req, reply) => {
    const route = `${req.method} ${req.routeOptions?.url ?? req.url}`;
    bumpRequestCount(route);
    if (reply.statusCode >= 500) bumpErrorCount(route);
  });

  app.get("/health", async () => ({
    service: `${GAME.slug}-api`,
    name: GAME.name,
    ok: true,
  }));

  const db = getDb();

  registerChatRoutes(app, redis);
  registerSpectateRoute(app);
  registerFriendsRoutes(app, db);
  registerPresenceRoute(app, redis);
  registerDmRoutes(app, redis);
  registerCharacterRoutes(app, db);
  registerMarketRoutes(app, db);
  registerCosmeticRoute(app, db);
  registerAdminRoutes(app, db);
  registerEventsRoutes(app, redis);
  return app;
}

async function main(): Promise<void> {
  const port = Number(process.env["API_PORT"] ?? 3000);
  const app = buildApp();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[api] ${GAME.slug} listening on :${port}`);
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");

if (isDirectRun) {
  main().catch((err) => {
    console.error("[api] fatal", err);
    process.exit(1);
  });
}
