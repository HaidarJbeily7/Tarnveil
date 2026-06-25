import {
  DEFAULT_ISO,
  tileToScreen,
  type TileCoord,
} from "@tarnveil/shared";

export { DEFAULT_ISO, tileToScreen, screenToTile, type TileCoord } from "@tarnveil/shared";

export interface IsoOrigin {
  x: number;
  y: number;
}

/** Convenience: scene-space pixel for a tile, given an origin. */
export function worldFromTile(origin: IsoOrigin, tile: TileCoord): { x: number; y: number } {
  const s = tileToScreen(tile);
  return { x: origin.x + s.x, y: origin.y + s.y };
}

/** Pull the half-width/half-height of a diamond out so callers don't recompute. */
export function diamondHalf(): { halfW: number; halfH: number } {
  return { halfW: DEFAULT_ISO.tileWidth / 2, halfH: DEFAULT_ISO.tileHeight / 2 };
}
