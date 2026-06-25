import Phaser from "phaser";
import { PALETTE, shade } from "./palette.js";

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
  color: number;
  label?: string;
  /** Remote avatars get a tag; self omits one. */
  showLabel: boolean;
}

function createAvatar(scene: Phaser.Scene, opts: AvatarOpts): PlayerVisual {
  const container = scene.add.container(0, 0);
  // The body group bobs while idle; we tween its y instead of the container's
  // so position tweens (walk steps) stay independent.
  const body = scene.add.container(0, 0);

  // Drop shadow stays on the container so it doesn't bob with the body.
  const shadow = scene.add.ellipse(0, 9, 22, 7, PALETTE.shadow, 0.45);

  // Legs — two stubby rectangles anchored at the top so they swing from the hip.
  const legBack = makeLimb(scene, opts.color, 3, 8);
  legBack.setPosition(-3, 4);
  const legFront = makeLimb(scene, opts.color, 3, 8);
  legFront.setPosition(3, 4);

  // Arms — slimmer, slightly darker.
  const armBack = makeLimb(scene, shade(opts.color, -0.05), 2.5, 9);
  armBack.setPosition(-6, -4);
  const armFront = makeLimb(scene, shade(opts.color, -0.05), 2.5, 9);
  armFront.setPosition(6, -4);

  // Torso — diamond
  const torso = scene.add
    .polygon(0, 0, [0, -10, 7, -2, 5, 8, -5, 8, -7, -2], opts.color, 1)
    .setStrokeStyle(1, 0x2a1c10);

  // Chest highlight
  const highlight = scene.add.polygon(
    0,
    0,
    [-3, -5, 3, -5, 0, 4],
    shade(opts.color, 0.2),
    0.85,
  );

  // Head + eyes
  const head = scene.add
    .circle(0, -13, 5, shade(opts.color, 0.1), 1)
    .setStrokeStyle(1, 0x2a1c10);
  const eyeL = scene.add.circle(-1.5, -13, 0.7, 0x000000, 1);
  const eyeR = scene.add.circle(1.5, -13, 0.7, 0x000000, 1);

  body.add([legBack, legFront, armBack, armFront, torso, highlight, head, eyeL, eyeR]);

  let tag: Phaser.GameObjects.Text | null = null;
  if (opts.showLabel) {
    tag = scene.add
      .text(0, -24, opts.label ?? "", {
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

  // Idle bob — gentle, persistent. Stopped on demand for reduce-motion.
  let idleBob: Phaser.Tweens.Tween | null = scene.tweens.add({
    targets: body,
    y: { from: 0, to: -1.5 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });

  // Walk tweens swing limbs while moving.
  let walkTweens: Phaser.Tweens.Tween[] = [];
  let walking = false;
  let reduceMotion = false;

  function startWalkTweens(): void {
    stopWalkTweens();
    if (reduceMotion) return;
    const swing = 14;
    walkTweens = [
      scene.tweens.add({
        targets: legBack,
        angle: { from: -swing, to: swing },
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      }),
      scene.tweens.add({
        targets: legFront,
        angle: { from: swing, to: -swing },
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      }),
      scene.tweens.add({
        targets: armBack,
        angle: { from: swing, to: -swing },
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      }),
      scene.tweens.add({
        targets: armFront,
        angle: { from: -swing, to: swing },
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      }),
    ];
  }
  function stopWalkTweens(): void {
    for (const tw of walkTweens) tw.stop();
    walkTweens = [];
    legBack.setAngle(0);
    legFront.setAngle(0);
    armBack.setAngle(0);
    armFront.setAngle(0);
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
      if (walking) startWalkTweens();
      else stopWalkTweens();
    },
    setNameTagVisible(visible) {
      if (tag !== null) tag.setVisible(visible);
    },
    setReduceMotion(reduce) {
      reduceMotion = reduce;
      if (reduce) {
        if (idleBob !== null) idleBob.stop();
        idleBob = null;
        body.setY(0);
        stopWalkTweens();
      } else if (idleBob === null) {
        idleBob = scene.tweens.add({
          targets: body,
          y: { from: 0, to: -1.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        });
        if (walking) startWalkTweens();
      }
    },
    destroy() {
      stopWalkTweens();
      if (idleBob !== null) idleBob.stop();
      container.destroy(true);
    },
  };
}

function makeLimb(
  scene: Phaser.Scene,
  color: number,
  width: number,
  height: number,
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const rect = scene.add
    .rectangle(0, height / 2, width, height, color, 1)
    .setStrokeStyle(1, 0x2a1c10);
  c.add(rect);
  return c;
}

export function createSelfAvatar(scene: Phaser.Scene): PlayerVisual {
  return createAvatar(scene, { color: PALETTE.self, showLabel: false });
}

export function createRemoteAvatar(scene: Phaser.Scene, label: string): PlayerVisual {
  return createAvatar(scene, { color: PALETTE.remote, label, showLabel: true });
}
