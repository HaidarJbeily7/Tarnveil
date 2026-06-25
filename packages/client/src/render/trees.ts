import Phaser from "phaser";
import { PALETTE } from "./palette.js";

export interface TreeVisual {
  container: Phaser.GameObjects.Container;
  canopy: Phaser.GameObjects.Container;
  chopBounce(scene: Phaser.Scene): void;
  destroy(): void;
}

/**
 * Procedural low-poly tree centred at (x, y) on `scene`. Layout:
 *   shadow (ellipse)  |  trunk + side-shade  |  canopy (3 stacked polys)
 * Canopy lives in its own Container so chop tweens hit the whole foliage.
 */
export function createTree(scene: Phaser.Scene, x: number, y: number): TreeVisual {
  const container = scene.add.container(x, y);

  // Drop shadow — sits at tile centre under everything.
  const shadow = scene.add.ellipse(0, 4, 32, 10, PALETTE.shadow, 0.4);

  // Trunk: front + darker side shade.
  const trunk = scene.add
    .rectangle(0, -2, 8, 22, PALETTE.trunk, 1)
    .setStrokeStyle(1, PALETTE.trunkDark);
  const trunkShade = scene.add.rectangle(2.5, -2, 3, 22, PALETTE.trunkDark, 0.5);

  // Canopy: three offset polygons in a sub-container so we can tween it as a
  // whole on chop. Order (back→front): dark base, midtone, light highlight.
  const canopy = scene.add.container(0, -20);
  const base = scene.add
    .polygon(0, 4, [0, -24, 22, 10, -22, 10], PALETTE.canopyB, 1)
    .setStrokeStyle(1, 0x152a15);
  const mid = scene.add
    .polygon(2, -2, [0, -22, 18, 8, -18, 8], PALETTE.canopyA, 1)
    .setStrokeStyle(1, 0x183018);
  const hi = scene.add.polygon(-3, -8, [0, -16, 12, 4, -12, 4], PALETTE.canopyC, 1);
  canopy.add([base, mid, hi]);

  container.add([shadow, trunk, trunkShade, canopy]);

  // Idle sway — gentle, persistent. Doesn't fight the chop tween because that
  // mutates scaleX/scaleY while this nudges angle.
  scene.tweens.add({
    targets: canopy,
    angle: { from: -1.4, to: 1.4 },
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });

  return {
    container,
    canopy,
    chopBounce(s) {
      s.tweens.add({
        targets: canopy,
        scaleX: 1.15,
        scaleY: 0.85,
        yoyo: true,
        duration: 100,
      });
    },
    destroy() {
      container.destroy(true);
    },
  };
}
