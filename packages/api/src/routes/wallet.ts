import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { issueNonce, verifySignIn, type SignInInput } from "../crypto/signin.js";

interface SignInBody {
  nonce?: string;
  pubkey?: string;
  signature?: string;
}

export function registerWalletRoutes(app: FastifyInstance, redis: Redis): void {
  app.post("/api/wallet/nonce", async () => {
    return issueNonce(redis);
  });

  app.post<{ Body: SignInBody }>("/api/wallet/sign-in", async (req, reply) => {
    const { nonce, pubkey, signature } = req.body ?? {};
    if (
      typeof nonce !== "string" ||
      typeof pubkey !== "string" ||
      typeof signature !== "string"
    ) {
      reply.code(400);
      return { error: "bad-input" };
    }
    const input: SignInInput = { nonce, pubkey, signature };
    const result = await verifySignIn(redis, input);
    if (!result.ok) {
      reply.code(401);
      return { error: result.reason };
    }
    return {
      token: result.token,
      pubkey: result.pubkey,
      expiresInSeconds: result.expiresInSeconds,
    };
  });
}
