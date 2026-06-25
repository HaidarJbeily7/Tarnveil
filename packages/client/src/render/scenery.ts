import Phaser from "phaser";
import { renderOrder, type TileCoord } from "@tarnveil/shared";
import { PALETTE, shade } from "./palette.js";
import { worldFromTile, type IsoOrigin } from "./iso.js";

export type SceneryKind = "rock" | "grass" | "mushroom" | "flower";

export interface SceneryPlacement {
  tile: TileCoord;
  kind: SceneryKind;
  /** small deterministic seed so per-instance variation is stable per tile */
  seed: number;
}

/**
 * Deterministic decorations for the visible playable area. None of these are
 * walkable obstacles — they're cosmetic only and live on top of the tile grid
 * but below the player avatar (depth 0).
 */
export const DEFAULT_SCENERY: ReadonlyArray<SceneryPlacement> = [
  { tile: { col: 0, row: 4 }, kind: "rock", seed: 1 },
  { tile: { col: 2, row: 7 }, kind: "rock", seed: 2 },
  { tile: { col: 8, row: 3 }, kind: "rock", seed: 3 },
  { tile: { col: 4, row: 0 }, kind: "grass", seed: 4 },
  { tile: { col: 7, row: 1 }, kind: "grass", seed: 5 },
  { tile: { col: 1, row: 6 }, kind: "grass", seed: 6 },
  { tile: { col: 6, row: 8 }, kind: "grass", seed: 7 },
  { tile: { col: 3, row: 1 }, kind: "flower", seed: 8 },
  { tile: { col: 8, row: 7 }, kind: "flower", seed: 9 },
  { tile: { col: 4, row: 8 }, kind: "mushroom", seed: 10 },
  { tile: { col: 0, row: 0 }, kind: "mushroom", seed: 11 },
];

/**
 * Render all scenery items into the scene, sorted back-to-front by (col+row)
 * so closer-to-camera items occlude farther ones.
 */
export function drawScenery(
  scene: Phaser.Scene,
  origin: IsoOrigin,
  placements: ReadonlyArray<SceneryPlacement> = DEFAULT_SCENERY,
): void {
  const sorted = [...placements].sort((a, b) => renderOrder(a.tile) - renderOrder(b.tile));
  for (const p of sorted) {
    const { x, y } = worldFromTile(origin, p.tile);
    switch (p.kind) {
      case "rock":
        drawRock(scene, x, y, p.seed);
        break;
      case "grass":
        drawGrass(scene, x, y, p.seed);
        break;
      case "mushroom":
        drawMushroom(scene, x, y, p.seed);
        break;
      case "flower":
        drawFlower(scene, x, y, p.seed);
        break;
    }
  }
}

function drawRock(scene: Phaser.Scene, x: number, y: number, seed: number): void {
  scene.add.ellipse(x, y + 4, 16, 5, PALETTE.shadow, 0.4);
  const w = 14 + (seed % 4);
  const h = 9 + (seed % 3);
  scene.add
    .ellipse(x, y - 1, w, h, 0x8c8c8c, 1)
    .setStrokeStyle(1, 0x404040, 0.8);
  scene.add.ellipse(x - 3, y - 3, 6, 3, 0xbcbcbc, 0.8);
}

function drawGrass(scene: Phaser.Scene, x: number, y: number, seed: number): void {
  const lean = ((seed * 7) % 5) - 2;
  const colorA = shade(PALETTE.canopyA, 0.05);
  const colorB = shade(PALETTE.canopyA, 0.2);
  // Three blades at slight offsets.
  for (let i = -1; i <= 1; i++) {
    const bx = x + i * 4;
    const tipY = y - 8 - (i === 0 ? 2 : 0);
    scene.add.triangle(
      bx,
      y,
      -2,
      4,
      2,
      4,
      lean,
      tipY - y + 4,
      i === 0 ? colorB : colorA,
    );
  }
}

function drawMushroom(scene: Phaser.Scene, x: number, y: number, _seed: number): void {
  scene.add.ellipse(x, y + 3, 10, 4, PALETTE.shadow, 0.4);
  // Stem
  scene.add.rectangle(x, y - 1, 3, 6, 0xe8e2cf, 1).setStrokeStyle(1, 0x2a1c10);
  // Cap
  const cap = scene.add.ellipse(x, y - 5, 12, 8, 0xb04545, 1);
  cap.setStrokeStyle(1, 0x4a1c1c);
  // Two white dots on the cap
  scene.add.circle(x - 2, y - 6, 1.4, 0xffffff, 1);
  scene.add.circle(x + 2.5, y - 4.5, 1.2, 0xffffff, 1);
}

function drawFlower(scene: Phaser.Scene, x: number, y: number, seed: number): void {
  const colors = [0xf28db2, 0xf2c66d, 0xc4a5e8, 0x8ed3e8];
  const color = colors[seed % colors.length] ?? 0xffffff;
  scene.add.rectangle(x, y - 2, 1.5, 8, PALETTE.canopyA, 1);
  // Five petals around a yellow centre
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5;
    const px = x + Math.cos(angle) * 3;
    const py = y - 6 + Math.sin(angle) * 3;
    scene.add.circle(px, py, 2, color, 1);
  }
  scene.add.circle(x, y - 6, 1.4, 0xffd166, 1);
}
