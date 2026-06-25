import Phaser from "phaser";
import { renderOrder, type TileCoord } from "@tarnveil/shared";
import { PALETTE } from "./palette.js";
import { worldFromTile, type IsoOrigin } from "./iso.js";
import { sprite } from "./sprite.js";

export type SceneryKind = "rock";

export interface SceneryPlacement {
  tile: TileCoord;
  kind: SceneryKind;
  /** small deterministic seed so per-instance variation is stable per tile */
  seed: number;
}

/**
 * UI_FIX_2 F4 — scenery is rendered from loaded sprites only.
 *
 * The earlier procedural mushrooms / flowers / grass tufts were CC0-styled
 * placeholders that read as debug primitives — they're gone. Rocks now use
 * the Kenney isometric crate texture (registered as "world-crate" in
 * WorldScene.preload). The asset gap for organic flora (trees beyond the
 * single tutorial tree, bushes, plants) is intentionally surfaced rather
 * than papered over.
 */
export const DEFAULT_SCENERY: ReadonlyArray<SceneryPlacement> = [
  { tile: { col: 0, row: 4 }, kind: "rock", seed: 1 },
  { tile: { col: 2, row: 7 }, kind: "rock", seed: 2 },
  { tile: { col: 8, row: 3 }, kind: "rock", seed: 3 },
  { tile: { col: 1, row: 8 }, kind: "rock", seed: 4 },
  { tile: { col: 7, row: 1 }, kind: "rock", seed: 5 },
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
    }
  }
}

function drawRock(scene: Phaser.Scene, x: number, y: number, seed: number): void {
  // Soft circular shadow under the rock so it sits on the ground.
  // Phaser arcs are world entities but this is the only authored shadow
  // primitive — scenery rocks ride on a single drop shadow each.
  scene.add.circle(x, y + 4, 12, PALETTE.shadow, 0.4);
  const rock = sprite(scene, x, y - 6, "world-crate");
  rock.setScale(0.12 + (seed % 3) * 0.01);
  rock.setOrigin(0.5, 0.85);
}
