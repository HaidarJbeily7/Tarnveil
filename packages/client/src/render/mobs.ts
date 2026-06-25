import Phaser from "phaser";
import { PALETTE } from "./palette.js";

export interface MobVisual {
  container: Phaser.GameObjects.Container;
  setPos(x: number, y: number): void;
  setHp(hp: number, hpMax: number): void;
  flashHit(scene: Phaser.Scene): void;
  destroy(): void;
}

const WOLF_BODY: ReadonlyArray<number> = [
  -12, -2, -8, -6, 6, -6, 12, -3, 10, 4, -2, 5, -8, 3, -12, 2,
];

export function createWolf(scene: Phaser.Scene): MobVisual {
  const container = scene.add.container(0, 0);

  const shadow = scene.add.ellipse(0, 8, 26, 7, PALETTE.shadow, 0.45);

  const body = scene.add
    .polygon(0, 0, [...WOLF_BODY], PALETTE.wolf, 1)
    .setStrokeStyle(1, 0x1c1c1c);

  // Two stubby leg trapezoids
  const legBack = scene.add.rectangle(-7, 4, 4, 6, PALETTE.wolfDark, 1);
  const legFront = scene.add.rectangle(6, 4, 4, 6, PALETTE.wolfDark, 1);

  // Ear triangle + eye dot
  const ear = scene.add.polygon(7, -8, [-1, 2, 2, -3, 3, 2], PALETTE.wolfDark, 1);
  const eye = scene.add.circle(8, -3, 1, 0xffffff, 1);

  const hpBar = scene.add.graphics();
  drawHpPips(hpBar, 1, 1);

  container.add([shadow, legBack, legFront, body, ear, eye, hpBar]);

  return {
    container,
    setPos(x, y) {
      container.setPosition(x, y);
    },
    setHp(hp, hpMax) {
      drawHpPips(hpBar, hp, hpMax);
    },
    flashHit(s) {
      s.tweens.add({
        targets: body,
        alpha: { from: 0.4, to: 1 },
        duration: 90,
        yoyo: true,
        repeat: 1,
      });
    },
    destroy() {
      container.destroy(true);
    },
  };
}

function drawHpPips(g: Phaser.GameObjects.Graphics, hp: number, hpMax: number): void {
  g.clear();
  const y = -16;
  const pipW = 5;
  const gap = 1;
  const totalW = hpMax * pipW + (hpMax - 1) * gap;
  const x = -totalW / 2;
  for (let i = 0; i < hpMax; i++) {
    g.fillStyle(i < hp ? PALETTE.hp : PALETTE.hpBg, 1);
    g.fillRect(x + i * (pipW + gap), y, pipW, 3);
  }
}
