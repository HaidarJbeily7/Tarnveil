import type { TileCoord } from "@tarnveil/shared";

export interface MobDef {
  id: string;
  kind: string;
  spawn: TileCoord;
  hpMax: number;
  /** Damage the mob deals to an adjacent player per tick. */
  damage: number;
  /** Chebyshev distance within which the mob will start chasing players. */
  aggroRange: number;
  drop: { kind: string; qty: number };
  /** ms between despawn (kill) and the mob reappearing at `spawn`. */
  respawnMs: number;
}

export const PLAYER_BASE_DAMAGE = 1;

export const ZONE_MOBS: readonly MobDef[] = [
  {
    id: "wolf-1",
    kind: "wolf",
    spawn: { col: 7, row: 7 },
    hpMax: 3,
    damage: 1,
    aggroRange: 3,
    drop: { kind: "hide", qty: 1 },
    respawnMs: 4_000,
  },
];

export function findMobDef(id: string): MobDef | undefined {
  return ZONE_MOBS.find((m) => m.id === id);
}
