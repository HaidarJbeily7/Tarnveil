import Phaser from "phaser";
import { renderOrder, type Grid, type TileCoord } from "@tarnveil/shared";
import { PALETTE, shade } from "./palette.js";
import { diamondHalf, worldFromTile, type IsoOrigin } from "./iso.js";

export interface TileGridOpts {
  size: number;
  checker?: boolean;
  edgeHighlight?: boolean;
}

/**
 * Render the iso grid into a single Graphics object. Checker pattern via
 * (col+row) parity and a subtle NW-edge highlight for low-poly lift.
 * Tiles flagged unwalkable on `grid` get a dirt fill instead of grass.
 */
export function drawTileGrid(
  scene: Phaser.Scene,
  origin: IsoOrigin,
  grid: Grid,
  opts: TileGridOpts,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const { halfW, halfH } = diamondHalf();

  const coords: TileCoord[] = [];
  for (let row = 0; row < opts.size; row++) {
    for (let col = 0; col < opts.size; col++) coords.push({ col, row });
  }
  coords.sort((a, b) => renderOrder(a) - renderOrder(b));

  for (const tile of coords) {
    const { x, y } = worldFromTile(origin, tile);
    const walkable = grid.isWalkable(tile.col, tile.row);
    const checkered = opts.checker !== false && ((tile.col + tile.row) & 1) === 1;
    const baseFill = !walkable
      ? PALETTE.dirt
      : checkered
        ? PALETTE.grassB
        : PALETTE.grassA;

    g.fillStyle(baseFill, 1);
    g.lineStyle(1, PALETTE.grassEdge, 0.7);
    g.beginPath();
    g.moveTo(x, y - halfH);
    g.lineTo(x + halfW, y);
    g.lineTo(x, y + halfH);
    g.lineTo(x - halfW, y);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // NW-edge highlight: lift the two top edges with a lighter stroke for a
    // faux directional-light look.
    if (opts.edgeHighlight !== false) {
      g.lineStyle(1, shade(baseFill, 0.18), 0.9);
      g.beginPath();
      g.moveTo(x - halfW, y);
      g.lineTo(x, y - halfH);
      g.lineTo(x + halfW, y);
      g.strokePath();
    }
  }
  return g;
}

export interface HoverHighlight {
  setTile(t: TileCoord | null): void;
  destroy(): void;
}

/**
 * A tiny Graphics that redraws a single diamond outline at the hovered tile.
 * Pointer-move never repaints the whole grid.
 */
export function makeHoverHighlight(
  scene: Phaser.Scene,
  origin: IsoOrigin,
): HoverHighlight {
  const g = scene.add.graphics();
  const { halfW, halfH } = diamondHalf();
  let current: TileCoord | null = null;

  function repaint(): void {
    g.clear();
    if (current === null) return;
    const { x, y } = worldFromTile(origin, current);
    g.lineStyle(2, PALETTE.hover, 1);
    g.fillStyle(PALETTE.hover, 0.12);
    g.beginPath();
    g.moveTo(x, y - halfH);
    g.lineTo(x + halfW, y);
    g.lineTo(x, y + halfH);
    g.lineTo(x - halfW, y);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  return {
    setTile(t) {
      if (
        t === null
          ? current === null
          : current !== null && current.col === t.col && current.row === t.row
      ) {
        return;
      }
      current = t === null ? null : { col: t.col, row: t.row };
      repaint();
    },
    destroy() {
      g.destroy();
    },
  };
}
