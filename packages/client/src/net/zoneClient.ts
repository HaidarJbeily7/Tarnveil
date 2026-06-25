import { Client, getStateCallbacks, type Room } from "colyseus.js";
import { GAME } from "@tarnveil/shared/game.config";

export interface RemoteSnapshot {
  id: string;
  col: number;
  row: number;
}

export interface MobSnapshot {
  id: string;
  kind: string;
  col: number;
  row: number;
  hp: number;
  hpMax: number;
}

export interface ZoneNetClient {
  selfId: string;
  onPlayerAdd(cb: (snap: RemoteSnapshot) => void): void;
  onPlayerChange(cb: (snap: RemoteSnapshot) => void): void;
  onPlayerRemove(cb: (id: string) => void): void;
  onMobAdd(cb: (snap: MobSnapshot) => void): void;
  onMobChange(cb: (snap: MobSnapshot) => void): void;
  onMobRemove(cb: (id: string) => void): void;
  sendMoveTo(col: number, row: number): void;
  disconnect(): Promise<void>;
}

const DEFAULT_ENDPOINT = "ws://localhost:2567";
const CONNECT_TIMEOUT_MS = 800;

interface RawPlayer {
  col: number;
  row: number;
}

interface RawMob {
  kind: string;
  col: number;
  row: number;
  hp: number;
  hpMax: number;
}

interface RawState {
  players: { onAdd: unknown; onChange: unknown; onRemove: unknown };
  mobs: { onAdd: unknown; onChange: unknown; onRemove: unknown };
}

export async function connectZone(
  endpoint: string = DEFAULT_ENDPOINT,
): Promise<ZoneNetClient> {
  const client = new Client(endpoint);
  const roomName = `${GAME.slug}-zone`;

  const joined: Room = await Promise.race([
    client.joinOrCreate(roomName) as Promise<Room>,
    new Promise<Room>((_, rej) =>
      setTimeout(() => rej(new Error(`connect timeout ${endpoint}`)), CONNECT_TIMEOUT_MS),
    ),
  ]);

  const cb = getStateCallbacks(joined);
  const state = joined.state as unknown as RawState;

  const playersHandle = cb(state).players as unknown as {
    onAdd(handler: (player: RawPlayer, key: string) => void): void;
    onChange(handler: (player: RawPlayer, key: string) => void): void;
    onRemove(handler: (player: RawPlayer, key: string) => void): void;
  };

  const mobsHandle = cb(state).mobs as unknown as {
    onAdd(handler: (mob: RawMob, key: string) => void): void;
    onChange(handler: (mob: RawMob, key: string) => void): void;
    onRemove(handler: (mob: RawMob, key: string) => void): void;
  };

  return {
    selfId: joined.sessionId,
    onPlayerAdd(handler) {
      playersHandle.onAdd((player, key) => {
        handler({ id: key, col: player.col, row: player.row });
      });
    },
    onPlayerChange(handler) {
      playersHandle.onChange((player, key) => {
        handler({ id: key, col: player.col, row: player.row });
      });
    },
    onPlayerRemove(handler) {
      playersHandle.onRemove((_player, key) => {
        handler(key);
      });
    },
    onMobAdd(handler) {
      mobsHandle.onAdd((mob, key) => {
        handler({ id: key, kind: mob.kind, col: mob.col, row: mob.row, hp: mob.hp, hpMax: mob.hpMax });
      });
    },
    onMobChange(handler) {
      mobsHandle.onChange((mob, key) => {
        handler({ id: key, kind: mob.kind, col: mob.col, row: mob.row, hp: mob.hp, hpMax: mob.hpMax });
      });
    },
    onMobRemove(handler) {
      mobsHandle.onRemove((_mob, key) => {
        handler(key);
      });
    },
    sendMoveTo(col, row) {
      joined.send("move-to", { col, row });
    },
    async disconnect() {
      try {
        await joined.leave();
      } catch {
        // best-effort
      }
    },
  };
}
