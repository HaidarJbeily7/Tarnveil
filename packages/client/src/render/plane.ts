import Phaser from "phaser";
import { DEFAULT_ISO } from "@tarnveil/shared";
import { PALETTE, shade } from "./palette.js";
import type { IsoOrigin } from "./iso.js";

/**
 * Render a darker "base" diamond underneath the playable grid so the world
 * reads as a floating island sitting on its own shadow. Drawn once, no tween.
 */
export function drawPlaneBase(
  scene: Phaser.Scene,
  origin: IsoOrigin,
  size: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(-10);
  const halfW = DEFAULT_ISO.tileWidth / 2;
  const halfH = DEFAULT_ISO.tileHeight / 2;
  const span = size; // tiles per side

  // The grid spans from tile (0,0) to (size-1, size-1). The four bounding
  // diamond corners in world-space, with a small outward pad:
  const pad = 1.2;
  const west = { x: origin.x - halfW * (span - 1 + pad), y: origin.y + halfH * (span - 1) };
  const east = { x: origin.x + halfW * (span - 1 + pad), y: origin.y + halfH * (span - 1) };
  const north = { x: origin.x, y: origin.y - halfH * pad };
  const south = { x: origin.x, y: origin.y + halfH * (2 * (span - 1) + pad) };

  // Outer-most halo — soft, large, very dark.
  g.fillStyle(PALETTE.shadow, 0.45);
  g.beginPath();
  g.moveTo(north.x, north.y + 8);
  g.lineTo(east.x + 6, east.y + 8);
  g.lineTo(south.x, south.y + 8);
  g.lineTo(west.x - 6, west.y + 8);
  g.closePath();
  g.fillPath();

  // Mid "earth" layer in dirt with a darker rim.
  g.fillStyle(shade(PALETTE.dirt, -0.3), 1);
  g.lineStyle(2, shade(PALETTE.dirt, -0.55), 1);
  g.beginPath();
  g.moveTo(north.x, north.y + 4);
  g.lineTo(east.x, east.y + 4);
  g.lineTo(south.x, south.y + 4);
  g.lineTo(west.x, west.y + 4);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Top rim of the base — lighter dirt, immediately below the playable tiles.
  g.fillStyle(PALETTE.dirt, 1);
  g.beginPath();
  g.moveTo(north.x, north.y);
  g.lineTo(east.x, east.y);
  g.lineTo(south.x, south.y);
  g.lineTo(west.x, west.y);
  g.closePath();
  g.fillPath();

  return g;
}
