import "dotenv/config";
import Fastify from "fastify";
import { GAME } from "@tarnveil/shared/game.config";
import { getRedis } from "./redis.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerSpectateRoute } from "./routes/spectate.js";

export function buildApp(): ReturnType<typeof Fastify> {
  const app = Fastify({ logger: false });
  const redis = getRedis();

  app.get("/health", async () => ({
    service: `${GAME.slug}-api`,
    name: GAME.name,
    ok: true,
  }));

  registerChatRoutes(app, redis);
  registerSpectateRoute(app);
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
