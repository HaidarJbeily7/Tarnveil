import Phaser from "phaser";
import { PALETTE } from "./palette.js";

/** Expanding ring at (x, y) that fades out. ~300ms. Self-destructs. */
export function clickRing(scene: Phaser.Scene, x: number, y: number, color: number = PALETTE.ui): void {
  const ring = scene.add.circle(x, y, 4).setStrokeStyle(2, color, 1).setFillStyle(color, 0).setDepth(50);
  scene.tweens.add({
    targets: ring,
    scale: { from: 1, to: 4.5 },
    alpha: { from: 1, to: 0 },
    duration: 320,
    ease: "Cubic.Out",
    onComplete: () => ring.destroy(),
  });
}

/** Rises and fades. ~600ms. Self-destructs. */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string = "#ffd166",
): void {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "14px",
      color,
      stroke: "#000",
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(60);
  scene.tweens.add({
    targets: t,
    y: y - 28,
    alpha: { from: 1, to: 0 },
    duration: 650,
    ease: "Cubic.Out",
    onComplete: () => t.destroy(),
  });
}

/** Yoyo'd alpha flash on a Game Object — wraps it briefly. */
export function hitFlash(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & { alpha?: number },
): void {
  scene.tweens.add({
    targets: target,
    alpha: { from: 0.35, to: 1 },
    duration: 90,
    yoyo: true,
    repeat: 1,
  });
}

/** Four little chips that fly out and fall away — chop / hit confetti. */
export function chopBurst(scene: Phaser.Scene, x: number, y: number): void {
  const colors = [PALETTE.canopyB, PALETTE.canopyA, PALETTE.canopyC, PALETTE.trunk];
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.4;
    const speed = 14 + Math.random() * 6;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const color = colors[i % colors.length]!;
    const chip = scene.add
      .rectangle(x, y, 4, 4, color, 1)
      .setStrokeStyle(1, 0x000000, 0.4)
      .setDepth(55);
    scene.tweens.add({
      targets: chip,
      x: x + dx,
      y: y + dy + 18,
      angle: 360,
      alpha: { from: 1, to: 0 },
      duration: 450,
      ease: "Cubic.Out",
      onComplete: () => chip.destroy(),
    });
  }
}
