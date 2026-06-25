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
 * F3 — render the iso grid from Kenney's CC0 floor texture. The texture
 * is registered in WorldScene.preload as "world-floor"; if it failed to
 * load we fall back to a flat-fill diamond (drawTileGridFallback) so the
 * scene still functions.
 *
 * Walkable tiles get the floor texture. Unwalkable tiles tint slightly
 * red so a blocked square reads at a glance.
 */
export function drawTileGrid(
  scene: Phaser.Scene,
  origin: IsoOrigin,
  grid: Grid,
  opts: TileGridOpts,
): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0);
  const hasTexture = scene.textures.exists("world-floor");

  const coords: TileCoord[] = [];
  for (let row = 0; row < opts.size; row++) {
    for (let col = 0; col < opts.size; col++) coords.push({ col, row });
  }
  coords.sort((a, b) => renderOrder(a) - renderOrder(b));

  if (!hasTexture) {
    layer.add(drawTileGridFallback(scene, origin, grid, opts, coords));
    return layer;
  }

  for (const tile of coords) {
    const { x, y } = worldFromTile(origin, tile);
    const walkable = grid.isWalkable(tile.col, tile.row);
    const img = scene.add.image(x, y, "world-floor");
    img.setScale(0.25);
    img.setOrigin(0.5, 0.5);
    img.setY(y - 4);
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
