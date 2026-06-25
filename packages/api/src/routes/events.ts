import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";

const EVENTS_KEY = "liveops:active";

const KNOWN_EVENTS: readonly { id: string; description: string }[] = [
  { id: "double-xp", description: "All XP grants are doubled at award time." },
  { id: "double-loot", description: "Mob drops grant two of the drop instead of one." },
  { id: "rare-drop-buff", description: "Rare-drop chance doubled for the duration." },
];

export function registerEventsRoutes(app: FastifyInstance, redis: Redis): void {
  app.get("/api/admin/events", async () => {
    const active = await redis.smembers(EVENTS_KEY);
    const set = new Set(active);
    return {
      events: KNOWN_EVENTS.map((e) => ({
        id: e.id,
        description: e.description,
        active: set.has(e.id),
      })),
    };
  });

  app.post<{ Params: { id: string } }>(
    "/api/admin/events/:id/enable",
    async (req, reply) => {
      if (!KNOWN_EVENTS.some((e) => e.id === req.params.id)) {
        reply.code(404); return { error: "unknown-event" };
      }
      await redis.sadd(EVENTS_KEY, req.params.id);
      return { id: req.params.id, active: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/admin/events/:id/disable",
    async (req, reply) => {
      if (!KNOWN_EVENTS.some((e) => e.id === req.params.id)) {
        reply.code(404); return { error: "unknown-event" };
      }
      await redis.srem(EVENTS_KEY, req.params.id);
      return { id: req.params.id, active: false };
    },
  );
}
