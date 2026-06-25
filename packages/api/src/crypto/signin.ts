import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import type Redis from "ioredis";
import { randomUUID } from "node:crypto";

const NONCE_TTL_SECONDS = 300;
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type BalanceFn = (pubkey: string) => Promise<number>;

const tokenGate: { minBalance: number; getBalance: BalanceFn } = {
  minBalance: Number(process.env["GAME_TOKEN_MIN"] ?? 0),
  // Default provider returns 0; real deployments wire a Solana RPC fetcher
  // via setTokenGate() before listen(). Tests inject their own.
  getBalance: async () => 0,
};

export function setTokenGate(minBalance: number, getBalance: BalanceFn): void {
  tokenGate.minBalance = Math.max(0, Math.floor(minBalance));
  tokenGate.getBalance = getBalance;
}

export function getTokenGate(): { minBalance: number; getBalance: BalanceFn } {
  return tokenGate;
}

function nonceKey(nonce: string): string {
  return `wallet:nonce:${nonce}`;
}

function sessionKey(token: string): string {
  return `wallet:session:${token}`;
}

export async function issueNonce(redis: Redis): Promise<{
  nonce: string;
  message: string;
  expiresInSeconds: number;
}> {
  const nonce = randomUUID();
  const message = `Tarnveil sign-in: ${nonce}`;
  await redis.set(nonceKey(nonce), "1", "EX", NONCE_TTL_SECONDS);
  return { nonce, message, expiresInSeconds: NONCE_TTL_SECONDS };
}

export type VerifySignInResult =
  | { ok: true; token: string; expiresInSeconds: number; pubkey: string }
  | { ok: false; reason: string };

export interface SignInInput {
  nonce: string;
  pubkey: string;
  /** base64-encoded ed25519 signature over `Tarnveil sign-in: <nonce>`. */
  signature: string;
}

/**
 * Verify a wallet sign-in. Steps:
 *  1. The nonce must still be live in Redis (server-issued, never replayed).
 *  2. The signature must verify against the expected message and pubkey.
 *  3. Burn the nonce so it can never be replayed.
 *  4. Issue and store a fresh opaque session token.
 */
export async function verifySignIn(
  redis: Redis,
  input: SignInInput,
): Promise<VerifySignInResult> {
  const { nonce, pubkey, signature } = input;
  if (!nonce || !pubkey || !signature) {
    return { ok: false, reason: "missing-fields" };
  }

  // Validate the pubkey is a real Solana address.
  let pk: PublicKey;
  try {
    pk = new PublicKey(pubkey);
  } catch {
    return { ok: false, reason: "bad-pubkey" };
  }

  const live = await redis.get(nonceKey(nonce));
  if (live === null) return { ok: false, reason: "nonce-expired-or-used" };

  const message = `Tarnveil sign-in: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(Buffer.from(signature, "base64"));
  } catch {
    return { ok: false, reason: "bad-signature-encoding" };
  }
  if (sigBytes.length !== 64) return { ok: false, reason: "bad-signature-length" };

  const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pk.toBytes());
  if (!ok) return { ok: false, reason: "bad-signature" };

  // Token gate (6.2). Below threshold → reject without issuing a session
  // OR burning the nonce, so a wallet that buys in can retry the same flow.
  if (tokenGate.minBalance > 0) {
    let balance: number;
    try {
      balance = await tokenGate.getBalance(pk.toBase58());
    } catch {
      return { ok: false, reason: "balance-check-failed" };
    }
    if (balance < tokenGate.minBalance) {
      return { ok: false, reason: "below-min-balance" };
    }
  }

  // Burn the nonce so it can't be replayed.
  await redis.del(nonceKey(nonce));

  const token = randomUUID();
  await redis.set(
    sessionKey(token),
    JSON.stringify({ pubkey, issuedAt: Date.now() }),
    "EX",
    SESSION_TTL_SECONDS,
  );

  return {
    ok: true,
    token,
    expiresInSeconds: SESSION_TTL_SECONDS,
    pubkey: pk.toBase58(),
  };
}

export async function readSession(
  redis: Redis,
  token: string,
): Promise<{ pubkey: string } | null> {
  const raw = await redis.get(sessionKey(token));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as { pubkey: string };
  } catch {
    return null;
  }
}
