import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { getPresence } from "../presence.js";

export function registerPresenceRoute(app: FastifyInstance, redis: Redis): void {
  app.get<{ Params: { characterId: string } }>(
    "/api/presence/:characterId",
    async (req) => {
      const zone = await getPresence(redis, req.params.characterId);
      return { characterId: req.params.characterId, zone, online: zone !== null };
    },
  );
}
