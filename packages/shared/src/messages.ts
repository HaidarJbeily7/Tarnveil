import type { TileCoord } from "./entities.js";

export interface ClientMessages {
  "move-to": TileCoord;
  "gather": { nodeId: string };
  "attack": { targetId: string };
}

export interface ServerMessages {
  "spawn": { selfId: string };
  "state": Record<string, unknown>;
  "error": { code: string; message: string };
}

export type ClientMessageName = keyof ClientMessages;
export type ServerMessageName = keyof ServerMessages;

export interface MessageEnvelope<TName extends string, TPayload> {
  type: TName;
  payload: TPayload;
}

export type ClientEnvelope = {
  [K in ClientMessageName]: MessageEnvelope<K, ClientMessages[K]>;
}[ClientMessageName];

export type ServerEnvelope = {
  [K in ServerMessageName]: MessageEnvelope<K, ServerMessages[K]>;
}[ServerMessageName];
