import Phaser from "phaser";
import {
  DEFAULT_ISO,
  findPath,
  gridFromMatrix,
  inRange,
  renderOrder,
  screenToTile,
  tileToScreen,
  type Grid,
  type TileCoord,
} from "@tarnveil/shared";
import { GAME } from "@tarnveil/shared/game.config";
import { connectZone, type ZoneNetClient } from "../net/zoneClient.js";

const GRID_SIZE = 10;
const TILE_FILL = 0x2a3a2a;
const TILE_STROKE = 0x4f6c4f;
const SELF_COLOR = 0xffd166;
const REMOTE_COLOR = 0x66ccff;
const TREE_TRUNK_COLOR = 0x6b4226;
const TREE_CANOPY_COLOR = 0x3b6b3b;
const STEP_MS = 180;
const REMOTE_INTERP_MS = 160;

const TREE_TILE: TileCoord = { col: 5, row: 5 };
const CHOP_RANGE = 1;

export interface ChopTestApi {
  getWood(): number;
  attemptChop(): "ok" | "out-of-range";
  setAvatarTile(tile: TileCoord): void;
  treeTile(): TileCoord;
  isNetworked(): boolean;
}

export class BootScene extends Phaser.Scene {
  private originX = 0;
  private originY = 0;
  private grid!: Grid;
  private avatarTile: TileCoord = { col: 1, row: 1 };
  private avatar!: Phaser.GameObjects.Arc;
  private canopy!: Phaser.GameObjects.Polygon;
  private moving = false;
  private wood = 0;
  private net: ZoneNetClient | null = null;
  private remotes = new Map<string, Phaser.GameObjects.Arc>();

  constructor() {
    super("boot");
  }

  create(): void {
    const { width, height } = this.scale;
    this.originX = width / 2;
    this.originY = height / 2 - (GRID_SIZE * DEFAULT_ISO.tileHeight) / 4;

    const matrix: boolean[][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        row.push(!(c === TREE_TILE.col && r === TREE_TILE.row));
      }
      matrix.push(row);
    }
    this.grid = gridFromMatrix(matrix);

    this.drawGrid();
    this.drawTree();
    this.avatar = this.add.circle(0, 0, 10, SELF_COLOR).setStrokeStyle(2, 0x000000);
    this.placeAvatarAt(this.avatarTile);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));

    this.add
      .text(width / 2, 20, GAME.name, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);

    this.exposeTestApi();
    this.updateHud();

    // Try multiplayer in the background; if it lands, we switch input to send
    // server intents and render remote players. If it doesn't, the existing
    // local mode runs unchanged. `?offline=1` skips the attempt entirely (used
    // by e2e tests that don't bring up the realtime server).
    const offline = new URLSearchParams(window.location.search).get("offline");
    if (offline !== "1") void this.tryConnect();
  }

  private async tryConnect(): Promise<void> {
    try {
      this.net = await connectZone();
    } catch {
      return;
    }
    this.avatar.setVisible(false);
    this.net.onPlayerAdd((snap) => this.upsertRemote(snap.id, snap.col, snap.row));
    this.net.onPlayerChange((snap) => this.upsertRemote(snap.id, snap.col, snap.row));
    this.net.onPlayerRemove((id) => this.removeRemote(id));
  }

  private upsertRemote(id: string, col: number, row: number): void {
    const screen = tileToScreen({ col, row });
    const x = this.originX + screen.x;
    const y = this.originY + screen.y;
    let dot = this.remotes.get(id);
    if (dot === undefined) {
      const color = id === this.net?.selfId ? SELF_COLOR : REMOTE_COLOR;
      dot = this.add.circle(x, y, 10, color).setStrokeStyle(2, 0x000000);
      this.remotes.set(id, dot);
      return;
    }
    // Interpolation between server snapshots — short tween instead of teleport.
    this.tweens.add({
      targets: dot,
      x,
      y,
      duration: REMOTE_INTERP_MS,
      ease: "Linear",
    });
  }

  private removeRemote(id: string): void {
    const dot = this.remotes.get(id);
    if (dot !== undefined) dot.destroy();
    this.remotes.delete(id);
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
    g.lineStyle(1, TILE_STROKE, 1);
    g.fillStyle(TILE_FILL, 1);

    for (const tile of coords) {
      const screen = tileToScreen(tile);
      const x = this.originX + screen.x;
      const y = this.originY + screen.y;
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

  private drawTree(): void {
    const s = tileToScreen(TREE_TILE);
    const cx = this.originX + s.x;
    const cy = this.originY + s.y;
    this.add
      .rectangle(cx, cy - 4, 6, 18, TREE_TRUNK_COLOR)
      .setStrokeStyle(1, 0x2a1c10);
    this.canopy = this.add
      .polygon(cx, cy - 18, [0, -22, 18, 10, -18, 10], TREE_CANOPY_COLOR)
      .setStrokeStyle(2, 0x152a15);
  }

  private placeAvatarAt(tile: TileCoord): void {
    const s = tileToScreen(tile);
    this.avatar.setPosition(this.originX + s.x, this.originY + s.y);
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    const tile = screenToTile({
      x: pointer.worldX - this.originX,
      y: pointer.worldY - this.originY,
    });

    // Tree chop is still local in Phase 0/1 (server-side chop arrives in 2.2).
    if (tile.col === TREE_TILE.col && tile.row === TREE_TILE.row) {
      this.chop();
      return;
    }

    if (this.net !== null) {
      // Networked: send intent; the server decides whether it lands.
      if (!this.grid.isWalkable(tile.col, tile.row)) return;
      this.net.sendMoveTo(tile.col, tile.row);
      return;
    }

    // Local fallback (Phase 0 behavior).
    if (this.moving) return;
    if (!this.grid.isWalkable(tile.col, tile.row)) return;
    const path = findPath(this.grid, this.avatarTile, tile);
    if (path.length < 2) return;
    this.walk(path.slice(1));
  }

  private chop(): "ok" | "out-of-range" {
    if (!inRange(this.avatarTile, TREE_TILE, CHOP_RANGE)) return "out-of-range";
    this.wood += 1;
    this.updateHud();
    this.tweens.add({
      targets: this.canopy,
      scaleX: 1.15,
      scaleY: 0.85,
      yoyo: true,
      duration: 100,
    });
    return "ok";
  }

  private updateHud(): void {
    const el = document.getElementById("hud-wood");
    if (el !== null) el.textContent = String(this.wood);
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

  private exposeTestApi(): void {
    const api: ChopTestApi = {
      getWood: () => this.wood,
      attemptChop: () => this.chop(),
      setAvatarTile: (t) => {
        this.avatarTile = { col: t.col, row: t.row };
        this.placeAvatarAt(this.avatarTile);
      },
      treeTile: () => ({ ...TREE_TILE }),
      isNetworked: () => this.net !== null,
    };
    (window as unknown as { __tarn?: ChopTestApi }).__tarn = api;
  }
}
