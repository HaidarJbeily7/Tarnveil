import Phaser from "phaser";
import { renderOrder, type Grid, type TileCoord } from "@tarnveil/shared";
import { PALETTE } from "./palette.js";
import { diamondHalf, worldFromTile, type IsoOrigin } from "./iso.js";

export interface TileGridOpts {
  size: number;
  checker?: boolean;
  edgeHighlight?: boolean;
}

/**
 * Render the iso grid from Kenney's CC0 floor textures.
 *
 * Geometry of the source images:
 *   - floor.png / floor-alt.png are 256×512 PNGs.
 *   - The visible diamond sits in the BOTTOM 1/4 of the frame; the rest is
 *     transparent space reserved for stacking 3D blocks on top.
 *   - The diamond itself is 256 wide × 128 tall — exactly the 4:1 ratio
 *     that matches TILE_WIDTH=64 / TILE_HEIGHT=32 scaled by 0.25.
 *
 * So at scale 0.25 the diamond renders 64×32 (one tile). The origin (0.5,
 * 0.875) lands the visible diamond's centre exactly on the placement point
 * — that's the tile centre returned by `worldFromTile`. Anything else
 * (0.5,0.5 with a y-fudge, etc.) drifts and produces visible seams.
 *
 * Walkable tiles render the primary floor; non-walkable tiles get a slight
 * red tint so a blocked square reads at a glance. With `opts.checker` we
 * alternate floor-alt to break up the grid visually.
 */
const TILE_TEXTURE_SCALE = 0.25;
const TILE_ORIGIN_Y = 0.875;

export function drawTileGrid(
  scene: Phaser.Scene,
  origin: IsoOrigin,
  grid: Grid,
  opts: TileGridOpts,
): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0);
  const hasFloor = scene.textures.exists("world-floor");
  const hasAlt = scene.textures.exists("world-floor-alt");

  const coords: TileCoord[] = [];
  for (let row = 0; row < opts.size; row++) {
    for (let col = 0; col < opts.size; col++) coords.push({ col, row });
  }
  coords.sort((a, b) => renderOrder(a) - renderOrder(b));

  if (!hasFloor) {
    layer.add(drawTileGridFallback(scene, origin, grid, opts, coords));
    return layer;
  }

  for (const tile of coords) {
    const { x, y } = worldFromTile(origin, tile);
    const walkable = grid.isWalkable(tile.col, tile.row);
    const checker = opts.checker !== false && ((tile.col + tile.row) & 1) === 1;
    const key = checker && hasAlt ? "world-floor-alt" : "world-floor";
    const img = scene.add.image(x, y, key);
    img.setOrigin(0.5, TILE_ORIGIN_Y);
    img.setScale(TILE_TEXTURE_SCALE);
    if (!walkable) img.setTint(0xc26a5a);
    layer.add(img);
  }
  return layer;
}

function drawTileGridFallback(
  scene: Phaser.Scene,
  origin: IsoOrigin,
  grid: Grid,
  opts: TileGridOpts,
  coords: ReadonlyArray<TileCoord>,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const { halfW, halfH } = diamondHalf();
  for (const tile of coords) {
    const { x, y } = worldFromTile(origin, tile);
    const walkable = grid.isWalkable(tile.col, tile.row);
    const baseFill = !walkable
      ? PALETTE.dirt
      : opts.checker !== false && ((tile.col + tile.row) & 1) === 1
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
  }
  return g;
}

export interface HoverHighlight {
  setTile(t: TileCoord | null): void;
  destroy(): void;
}

export function makeHoverHighlight(
  scene: Phaser.Scene,
  origin: IsoOrigin,
): HoverHighlight {
  const g = scene.add.graphics();
  g.setDepth(5);
  const { halfW, halfH } = diamondHalf();
  let current: TileCoord | null = null;

  function repaint(): void {
    g.clear();
    if (current === null) return;
    const { x, y } = worldFromTile(origin, current);
    g.lineStyle(2, PALETTE.hover, 1);
    g.fillStyle(PALETTE.hover, 0.16);
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
      ) return;
      current = t === null ? null : { col: t.col, row: t.row };
      repaint();
    },
    destroy() { g.destroy(); },
  };
}
