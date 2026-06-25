import type { TileCoord } from "./entities.js";

/** Chebyshev (king-move) distance — 1 means any of the 8 neighbours. */
export function tileDistance(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function inRange(a: TileCoord, b: TileCoord, range: number): boolean {
  return tileDistance(a, b) <= range;
}
