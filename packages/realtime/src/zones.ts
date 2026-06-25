import {
  gridFromMatrix,
  type Grid,
  type TileCoord,
} from "@tarnveil/shared";
import type { ResourceNode } from "./resources.js";
import type { MobDef } from "./mobs.js";
import { MAINLAND_MERCHANTS, type Merchant } from "./merchants.js";

export interface Portal {
  at: TileCoord;
  targetZone: string;
  spawnAt: TileCoord;
}

export interface ZoneConfig {
  id: string;
  spawn: TileCoord;
  /** Builds a fresh Grid per room instance. */
  buildGrid(): Grid;
  resources: readonly ResourceNode[];
  mobs: readonly MobDef[];
  /** Inclusive bounds. Players within these tiles regenerate HP per tick. */
  safeZone: { topLeft: TileCoord; bottomRight: TileCoord } | null;
  portals: readonly Portal[];
  merchants: readonly Merchant[];
}

const ZONE_SIZE = 10;

function openGrid(blocked: ReadonlyArray<TileCoord> = []): Grid {
  const matrix: boolean[][] = [];
  for (let r = 0; r < ZONE_SIZE; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < ZONE_SIZE; c++) row.push(true);
    matrix.push(row);
  }
  for (const b of blocked) {
    if (matrix[b.row]) matrix[b.row]![b.col] = false;
  }
  return gridFromMatrix(matrix);
}

const MAINLAND: ZoneConfig = {
  id: "mainland",
  spawn: { col: 1, row: 1 },
  buildGrid: () => openGrid([{ col: 3, row: 3 }, { col: 3, row: 4 }]),
  resources: [
    { id: "tree-1", kind: "tree", tile: { col: 5, row: 5 }, resource: "wood", requiredTool: "woodaxe", respawnMs: 2000 },
  ],
  mobs: [
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
  ],
  safeZone: { topLeft: { col: 0, row: 0 }, bottomRight: { col: 2, row: 2 } },
  portals: [
    { at: { col: 9, row: 9 }, targetZone: "gathering", spawnAt: { col: 1, row: 1 } },
    { at: { col: 9, row: 0 }, targetZone: "fishing", spawnAt: { col: 1, row: 1 } },
    { at: { col: 0, row: 9 }, targetZone: "pvp", spawnAt: { col: 1, row: 1 } },
  ],
  merchants: MAINLAND_MERCHANTS,
};

const GATHERING: ZoneConfig = {
  id: "gathering",
  spawn: { col: 1, row: 1 },
  buildGrid: () => openGrid(),
  resources: [
    { id: "tree-1", kind: "tree", tile: { col: 3, row: 3 }, resource: "wood", requiredTool: "woodaxe", respawnMs: 2000 },
    { id: "tree-2", kind: "tree", tile: { col: 5, row: 4 }, resource: "wood", requiredTool: "woodaxe", respawnMs: 2000 },
    { id: "rock-1", kind: "rock", tile: { col: 6, row: 6 }, resource: "stone", requiredTool: "pickaxe", respawnMs: 3000 },
    { id: "rock-2", kind: "rock", tile: { col: 7, row: 4 }, resource: "stone", requiredTool: "pickaxe", respawnMs: 3000 },
  ],
  mobs: [],
  safeZone: null,
  portals: [
    { at: { col: 0, row: 0 }, targetZone: "mainland", spawnAt: { col: 8, row: 8 } },
  ],
  merchants: [],
};

const PVP: ZoneConfig = {
  id: "pvp",
  spawn: { col: 1, row: 1 },
  buildGrid: () => openGrid(),
  resources: [],
  mobs: [
    {
      id: "wolf-1",
      kind: "wolf",
      spawn: { col: 7, row: 7 },
      hpMax: 5,
      damage: 2,
      aggroRange: 4,
      drop: { kind: "hide", qty: 1 },
      respawnMs: 6_000,
    },
    {
      id: "wolf-2",
      kind: "wolf",
      spawn: { col: 2, row: 8 },
      hpMax: 5,
      damage: 2,
      aggroRange: 4,
      drop: { kind: "hide", qty: 1 },
      respawnMs: 6_000,
    },
  ],
  safeZone: null,
  portals: [
    { at: { col: 0, row: 0 }, targetZone: "mainland", spawnAt: { col: 0, row: 8 } },
  ],
  merchants: [],
};

const FISHING: ZoneConfig = {
  id: "fishing",
  spawn: { col: 1, row: 1 },
  buildGrid: () => openGrid(),
  resources: [
    { id: "fish-1", kind: "fish", tile: { col: 4, row: 4 }, resource: "fish", requiredTool: "fishingrod", respawnMs: 2500 },
    { id: "fish-2", kind: "fish", tile: { col: 6, row: 5 }, resource: "fish", requiredTool: "fishingrod", respawnMs: 2500 },
  ],
  mobs: [],
  safeZone: { topLeft: { col: 0, row: 0 }, bottomRight: { col: 1, row: 9 } },
  portals: [
    { at: { col: 9, row: 9 }, targetZone: "mainland", spawnAt: { col: 8, row: 0 } },
  ],
  merchants: [],
};

export const ZONES: Record<string, ZoneConfig> = {
  mainland: MAINLAND,
  gathering: GATHERING,
  pvp: PVP,
  fishing: FISHING,
};

export const ZONE_IDS = Object.keys(ZONES);

export function getZoneConfig(id: string): ZoneConfig {
  const z = ZONES[id];
  if (z === undefined) throw new Error(`unknown zone: ${id}`);
  return z;
}
