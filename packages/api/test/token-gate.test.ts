import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { buildApp } from "../src/server.js";
import { closeRedis } from "../src/redis.js";
import { closeDb } from "../src/db.js";
import { setTokenGate } from "../src/crypto/signin.js";

function signMessage(message: string): {
  signatureB64: string;
  pubkey: string;
} {
  const keypair = nacl.sign.keyPair();
  const sig = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
  return {
    signatureB64: Buffer.from(sig).toString("base64"),
    pubkey: new PublicKey(keypair.publicKey).toBase58(),
  };
}

async function runSignInWithBalance(
  app: ReturnType<typeof buildApp>,
  balance: number,
): Promise<ReturnType<typeof app.inject>> {
  const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
  const { nonce, message } = JSON.parse(nonceRes.body) as {
    nonce: string;
    message: string;
  };
  const { signatureB64, pubkey } = signMessage(message);
  setTokenGate(10, async () => balance);
  return app.inject({
    method: "POST",
    url: "/api/wallet/sign-in",
    payload: { nonce, pubkey, signature: signatureB64 },
  });
}

describe("token gate (6.2, devnet/mock)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    setTokenGate(0, async () => 0);
    await app.close();
    await closeDb();
    await closeRedis();
  });

  beforeEach(() => {
    setTokenGate(0, async () => 0);
  });

  it("admits a wallet at or above the threshold", async () => {
    const res = await runSignInWithBalance(app, 15);
    expect(res.statusCode).toBe(200);
  });

  it("denies a wallet below the threshold", async () => {
    const res = await runSignInWithBalance(app, 5);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("below-min-balance");
  });

  it("denies and surfaces 'balance-check-failed' when the provider throws", async () => {
    const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
    const { nonce, message } = JSON.parse(nonceRes.body) as { nonce: string; message: string };
    const { signatureB64, pubkey } = signMessage(message);
    setTokenGate(10, async () => {
      throw new Error("rpc down");
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: { nonce, pubkey, signature: signatureB64 },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("balance-check-failed");
  });

  it("with minBalance=0, no gate is applied", async () => {
    setTokenGate(0, async () => 0);
    const nonceRes = await app.inject({ method: "POST", url: "/api/wallet/nonce" });
    const { nonce, message } = JSON.parse(nonceRes.body) as { nonce: string; message: string };
    const { signatureB64, pubkey } = signMessage(message);
    const res = await app.inject({
      method: "POST",
      url: "/api/wallet/sign-in",
      payload: { nonce, pubkey, signature: signatureB64 },
    });
    expect(res.statusCode).toBe(200);
  });
});
