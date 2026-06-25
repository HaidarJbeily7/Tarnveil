import Phaser from "phaser";
import {
  DEFAULT_ISO,
  renderOrder,
  tileToScreen,
  type TileCoord,
} from "@tarnveil/shared";
import { GAME } from "@tarnveil/shared/game.config";

const GRID_SIZE = 10;
const TILE_FILL = 0x2a3a2a;
const TILE_STROKE = 0x4f6c4f;
const TITLE_COLOR = "#ffffff";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const { width, height } = this.scale;
    const originX = width / 2;
    const originY = height / 2 - (GRID_SIZE * DEFAULT_ISO.tileHeight) / 4;

    const coords: TileCoord[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        coords.push({ col, row });
      }
    }
    coords.sort((a, b) => renderOrder(a) - renderOrder(b));

    const g = this.add.graphics();
    g.lineStyle(1, TILE_STROKE, 1);
    g.fillStyle(TILE_FILL, 1);

    const halfW = DEFAULT_ISO.tileWidth / 2;
    const halfH = DEFAULT_ISO.tileHeight / 2;

    for (const tile of coords) {
      const screen = tileToScreen(tile);
      const x = originX + screen.x;
      const y = originY + screen.y;
      g.beginPath();
      g.moveTo(x, y - halfH);
      g.lineTo(x + halfW, y);
      g.lineTo(x, y + halfH);
      g.lineTo(x - halfW, y);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }

    this.add
      .text(width / 2, 20, GAME.name, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: TITLE_COLOR,
      })
      .setOrigin(0.5, 0);
  }
}
