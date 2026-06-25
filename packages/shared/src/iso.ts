import { TILE_WIDTH, TILE_HEIGHT } from "./constants.js";
import type { TileCoord } from "./entities.js";

export interface IsoSize {
  tileWidth: number;
  tileHeight: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const DEFAULT_ISO: IsoSize = { tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT };

// Appendix A — tile (col,row) -> screen pixel
export function tileToScreen(coord: TileCoord, size: IsoSize = DEFAULT_ISO): ScreenPoint {
  const halfW = size.tileWidth / 2;
  const halfH = size.tileHeight / 2;
  return {
    x: (coord.col - coord.row) * halfW,
    y: (coord.col + coord.row) * halfH,
  };
}

// Appendix A — screen pixel -> tile (inverse). Snapped to integer tile.
export function screenToTile(point: ScreenPoint, size: IsoSize = DEFAULT_ISO): TileCoord {
  const halfW = size.tileWidth / 2;
  const halfH = size.tileHeight / 2;
  const col = (point.x / halfW + point.y / halfH) / 2;
  const row = (point.y / halfH - point.x / halfW) / 2;
  return { col: Math.round(col), row: Math.round(row) };
}

// Sort key for back-to-front rendering on the iso grid.
export function renderOrder(coord: TileCoord): number {
  return coord.col + coord.row;
}
