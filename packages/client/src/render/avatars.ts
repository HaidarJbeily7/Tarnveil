import Phaser from "phaser";
import { PALETTE, shade } from "./palette.js";

export interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  setPos(x: number, y: number): void;
  setName(label: string): void;
  destroy(): void;
}

interface AvatarOpts {
  color: number;
  label?: string;
  /** For remote avatars we always show a tag; for self we omit. */
  showLabel: boolean;
}

function createAvatar(scene: Phaser.Scene, opts: AvatarOpts): PlayerVisual {
  const container = scene.add.container(0, 0);

  const shadow = scene.add.ellipse(0, 8, 22, 7, PALETTE.shadow, 0.45);

  // Diamond torso
  const body = scene.add
    .polygon(
      0,
      0,
      [0, -14, 8, -4, 6, 8, -6, 8, -8, -4],
      opts.color,
      1,
    )
    .setStrokeStyle(1, 0x2a1c10);

  // Head
  const head = scene.add
    .circle(0, -12, 5, shade(opts.color, 0.1), 1)
    .setStrokeStyle(1, 0x2a1c10);

  // Chest highlight triangle
  const highlight = scene.add.polygon(
    0,
    -2,
    [-3, -6, 3, -6, 0, 4],
    shade(opts.color, 0.2),
    0.85,
  );

  let tag: Phaser.GameObjects.Text | null = null;
  if (opts.showLabel) {
    tag = scene.add
      .text(0, -22, opts.label ?? "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
  }

  const children: Phaser.GameObjects.GameObject[] = [shadow, body, highlight, head];
  if (tag !== null) children.push(tag);
  container.add(children);

  return {
    container,
    setPos(x, y) {
      container.setPosition(x, y);
    },
    setName(label) {
      if (tag !== null) tag.setText(label);
    },
    destroy() {
      container.destroy(true);
    },
  };
}

export function createSelfAvatar(scene: Phaser.Scene): PlayerVisual {
  return createAvatar(scene, { color: PALETTE.self, showLabel: false });
}

export function createRemoteAvatar(scene: Phaser.Scene, label: string): PlayerVisual {
  return createAvatar(scene, { color: PALETTE.remote, label, showLabel: true });
}
