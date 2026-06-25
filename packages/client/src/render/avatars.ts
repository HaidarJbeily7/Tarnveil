import Phaser from "phaser";
import { PALETTE } from "./palette.js";

/**
 * F3 — character visuals.
 *
 * The polygon stick figure is gone. Self / remote avatars are now Kenney
 * isometric Human sprites (CC0). The PlayerVisual API stays the same so
 * WorldScene callers and the settings panel that drives setReduceMotion
 * / setNameTagVisible keep working unchanged.
 *
 * Animation is a single idle frame for now. Walk is a vertical bob; later
 * commits can swap to the Run frames already in public/assets/world/.
 */

export interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  setPos(x: number, y: number): void;
  setName(label: string): void;
  setWalking(walking: boolean): void;
  setNameTagVisible(visible: boolean): void;
  setReduceMotion(reduce: boolean): void;
  destroy(): void;
}

interface AvatarOpts {
  texture: "world-player-idle" | "world-remote-idle";
  label?: string;
  showLabel: boolean;
  fallbackColor: number;
}

function createAvatar(scene: Phaser.Scene, opts: AvatarOpts): PlayerVisual {
  const container = scene.add.container(0, 0);
  const body = scene.add.container(0, 0);

  const shadow = scene.add.ellipse(0, 12, 24, 8, PALETTE.shadow, 0.5);

  const hasTexture = scene.textures.exists(opts.texture);
  let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  if (hasTexture) {
    sprite = scene.add.image(0, 0, opts.texture);
    sprite.setOrigin(0.5, 0.85);
    sprite.setScale(0.14);
  } else {
    sprite = scene.add.circle(0, -6, 8, opts.fallbackColor);
    sprite.setStrokeStyle(1, 0x000000);
  }
  body.add(sprite);

  let tag: Phaser.GameObjects.Text | null = null;
  if (opts.showLabel) {
    tag = scene.add
      .text(0, -30, opts.label ?? "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
  }

  const children: Phaser.GameObjects.GameObject[] = [shadow, body];
  if (tag !== null) children.push(tag);
  container.add(children);

  let idleBob: Phaser.Tweens.Tween | null = scene.tweens.add({
    targets: body,
    y: { from: 0, to: -2 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });

  let walkTween: Phaser.Tweens.Tween | null = null;
  let walking = false;
  let reduceMotion = false;

  function startWalk(): void {
    stopWalk();
    if (reduceMotion) return;
    walkTween = scene.tweens.add({
      targets: body,
      y: { from: 0, to: -4 },
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }
  function stopWalk(): void {
    if (walkTween !== null) {
      walkTween.stop();
      walkTween = null;
    }
    body.setY(0);
  }

  return {
    container,
    setPos(x, y) {
      container.setPosition(x, y);
    },
    setName(label) {
      if (tag !== null) tag.setText(label);
    },
    setWalking(next) {
      if (next === walking) return;
      walking = next;
      if (walking) startWalk();
      else stopWalk();
    },
    setNameTagVisible(visible) {
      if (tag !== null) tag.setVisible(visible);
    },
    setReduceMotion(reduce) {
      reduceMotion = reduce;
      if (reduce) {
        if (idleBob !== null) {
          idleBob.stop();
          idleBob = null;
        }
        stopWalk();
        body.setY(0);
      } else if (idleBob === null) {
        idleBob = scene.tweens.add({
          targets: body,
          y: { from: 0, to: -2 },
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        });
        if (walking) startWalk();
      }
    },
    destroy() {
      stopWalk();
      if (idleBob !== null) idleBob.stop();
      container.destroy(true);
    },
  };
}

export function createSelfAvatar(scene: Phaser.Scene): PlayerVisual {
  return createAvatar(scene, {
    texture: "world-player-idle",
    showLabel: false,
    fallbackColor: PALETTE.self,
  });
}

export function createRemoteAvatar(scene: Phaser.Scene, label: string): PlayerVisual {
  return createAvatar(scene, {
    texture: "world-remote-idle",
    label,
    showLabel: true,
    fallbackColor: PALETTE.remote,
  });
}
