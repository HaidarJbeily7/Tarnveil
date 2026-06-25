import Phaser from "phaser";
import {
  DEFAULT_ISO,
  findPath,
  gridFromMatrix,
  renderOrder,
  screenToTile,
  tileToScreen,
  type Grid,
  type TileCoord,
} from "@tarnveil/shared";
import { GAME } from "@tarnveil/shared/game.config";

const GRID_SIZE = 10;
const TILE_FILL = 0x2a3a2a;
const TILE_BLOCKED_FILL = 0x5a2a2a;
const TILE_STROKE = 0x4f6c4f;
const AVATAR_COLOR = 0xffd166;
const STEP_MS = 180;

const BLOCKED: ReadonlyArray<TileCoord> = [
  { col: 3, row: 3 },
  { col: 3, row: 4 },
  { col: 3, row: 5 },
];

export class BootScene extends Phaser.Scene {
  private originX = 0;
  private originY = 0;
  private grid!: Grid;
  private avatarTile: TileCoord = { col: 1, row: 1 };
  private avatar!: Phaser.GameObjects.Arc;
  private moving = false;

  constructor() {
    super("boot");
  }

  create(): void {
    const { width, height } = this.scale;
    this.originX = width / 2;
    this.originY = height / 2 - (GRID_SIZE * DEFAULT_ISO.tileHeight) / 4;

    const blockedKey = (c: number, r: number): boolean =>
      BLOCKED.some((b) => b.col === c && b.row === r);

    const matrix: boolean[][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < GRID_SIZE; c++) row.push(!blockedKey(c, r));
      matrix.push(row);
    }
    this.grid = gridFromMatrix(matrix);

    this.drawGrid();
    this.avatar = this.add.circle(0, 0, 10, AVATAR_COLOR).setStrokeStyle(2, 0x000000);
    this.placeAvatarAt(this.avatarTile);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));

    this.add
      .text(width / 2, 20, GAME.name, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);
  }

  private drawGrid(): void {
    const coords: TileCoord[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) coords.push({ col, row });
    }
    coords.sort((a, b) => renderOrder(a) - renderOrder(b));

    const g = this.add.graphics();
    const halfW = DEFAULT_ISO.tileWidth / 2;
    const halfH = DEFAULT_ISO.tileHeight / 2;

    for (const tile of coords) {
      const screen = tileToScreen(tile);
      const x = this.originX + screen.x;
      const y = this.originY + screen.y;
      const blocked = !this.grid.isWalkable(tile.col, tile.row);
      g.lineStyle(1, TILE_STROKE, 1);
      g.fillStyle(blocked ? TILE_BLOCKED_FILL : TILE_FILL, 1);
      g.beginPath();
      g.moveTo(x, y - halfH);
      g.lineTo(x + halfW, y);
      g.lineTo(x, y + halfH);
      g.lineTo(x - halfW, y);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }
  }

  private placeAvatarAt(tile: TileCoord): void {
    const s = tileToScreen(tile);
    this.avatar.setPosition(this.originX + s.x, this.originY + s.y);
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    if (this.moving) return;
    const tile = screenToTile({
      x: pointer.worldX - this.originX,
      y: pointer.worldY - this.originY,
    });
    if (!this.grid.isWalkable(tile.col, tile.row)) return;
    const path = findPath(this.grid, this.avatarTile, tile);
    if (path.length < 2) return;
    this.walk(path.slice(1));
  }

  private walk(steps: TileCoord[]): void {
    this.moving = true;
    let i = 0;
    const next = (): void => {
      if (i >= steps.length) {
        this.moving = false;
        return;
      }
      const target = steps[i++]!;
      const s = tileToScreen(target);
      this.tweens.add({
        targets: this.avatar,
        x: this.originX + s.x,
        y: this.originY + s.y,
        duration: STEP_MS,
        onComplete: () => {
          this.avatarTile = target;
          next();
        },
      });
    };
    next();
  }
}
