export type SkillId =
  | "combat"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "cooking";

export interface TileCoord {
  col: number;
  row: number;
}

export interface Tile extends TileCoord {
  walkable: boolean;
}

export interface Player {
  id: string;
  name: string;
  zone: string;
  pos: TileCoord;
  hp: number;
  hpMax: number;
  gold: number;
  skills: Record<SkillId, { xp: number; level: number }>;
}

export interface Item {
  id: string;
  kind: string;
  qty: number;
}
