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

// Concrete mob lists live in zones.ts; this module only defines the shape.
