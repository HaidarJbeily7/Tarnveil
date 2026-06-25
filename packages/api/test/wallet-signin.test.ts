import { describe, it, expect, beforeAll, afterAll } from "vitest";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { buildApp } from "../src/server.js";
import { closeRedis } from "../src/redis.js";
import { closeDb } from "../src/db.js";

function signSignInMessage(message: string): { keypair: nacl.SignKeyPair; signatureB64: string; pubkey: string } {
  const keypair = nacl.sign.keyPair();
  const sig = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
  return {
    keypair,
    signatureB64: Buffer.from(sig).toString("base64"),
    pubkey: new PublicKey(keypair.publicKey).toBase58(),
  };
}

describe("wallet sign-in", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDb();
    await closeRedis();
  });

  it("accepts a valid signature and issues a session token", async () => {
    const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
    const { nonce, message } = JSON.parse(nonceRes.body) as { nonce: string; message: string };

    const { signatureB64, pubkey } = signSignInMessage(message);

    const signRes = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: { nonce, pubkey, signature: signatureB64 },
    });
    expect(signRes.statusCode).toBe(200);
    const body = JSON.parse(signRes.body) as { token: string; pubkey: string };
    expect(body.token).toMatch(/[0-9a-f-]{8,}/);
    expect(body.pubkey).toBe(pubkey);
  });

  it("rejects a replayed nonce (used twice)", async () => {
    const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
    const { nonce, message } = JSON.parse(nonceRes.body) as { nonce: string; message: string };
    const { signatureB64, pubkey } = signSignInMessage(message);

    const first = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: { nonce, pubkey, signature: signatureB64 },
    });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: { nonce, pubkey, signature: signatureB64 },
    });
    expect(replay.statusCode).toBe(401);
    expect(JSON.parse(replay.body).error).toBe("nonce-expired-or-used");
  });

  it("rejects a forged signature (other key signs the message)", async () => {
    const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
    const { nonce, message } = JSON.parse(nonceRes.body) as { nonce: string; message: string };

    const legitimate = signSignInMessage(message);
    const attacker = nacl.sign.keyPair();
    // Attacker signs the message but the claimed pubkey is the legitimate one.
    const attackerSig = nacl.sign.detached(new TextEncoder().encode(message), attacker.secretKey);

    const res = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: {
        nonce,
        pubkey: legitimate.pubkey,
        signature: Buffer.from(attackerSig).toString("base64"),
      },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("bad-signature");
  });

  it("rejects a malformed pubkey", async () => {
    const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
    const { nonce, message } = JSON.parse(nonceRes.body) as { nonce: string; message: string };
    const { signatureB64 } = signSignInMessage(message);
    const res = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: { nonce, pubkey: "not-a-pubkey", signature: signatureB64 },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("bad-pubkey");
  });
});
