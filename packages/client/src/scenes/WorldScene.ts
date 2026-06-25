import Phaser from "phaser";
import {
  DEFAULT_ISO,
  findPath,
  gridFromMatrix,
  inRange,
  screenToTile,
  tileToScreen,
  type Grid,
  type TileCoord,
} from "@tarnveil/shared";
import { connectZone, type ZoneNetClient } from "../net/zoneClient.js";
import {
  createRemoteAvatar,
  createSelfAvatar,
  type PlayerVisual,
} from "../render/avatars.js";
import { chopBurst, clickRing, floatText, hitFlash } from "../render/effects.js";
import { createWolf, type MobVisual } from "../render/mobs.js";
import { PALETTE } from "../render/palette.js";
import { drawPlaneBase } from "../render/plane.js";
import { drawScenery } from "../render/scenery.js";
import { drawTileGrid, makeHoverHighlight, type HoverHighlight } from "../render/tiles.js";
import { createTree, type TreeVisual } from "../render/trees.js";
import { getCurrentSettings, type TarnSettings } from "../settings.js";

const GRID_SIZE = 10;
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

/**
 * The actual game world. Was BootScene through Phase 7; promoted to its own
 * scene so the HUD (HudScene) can stack above it without inheriting camera
 * follow / zoom. The `window.__tarn` test API stays attached here so the
 * existing e2e specs work unchanged.
 */
export class WorldScene extends Phaser.Scene {
  private originX = 0;
  private originY = 0;
  private grid!: Grid;
  private avatarTile: TileCoord = { col: 1, row: 1 };
  private avatar!: PlayerVisual;
  private tree!: TreeVisual;
  private hover!: HoverHighlight;
  private moving = false;
  private wood = 0;
  private net: ZoneNetClient | null = null;
  private remotes = new Map<string, PlayerVisual>();
  private mobs = new Map<string, { visual: MobVisual; hp: number }>();

  constructor() {
    super("world");
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

    drawPlaneBase(this, { x: this.originX, y: this.originY }, GRID_SIZE);
    this.drawGrid();
    drawScenery(this, { x: this.originX, y: this.originY });
    this.hover = makeHoverHighlight(this, { x: this.originX, y: this.originY });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const tile = screenToTile({
        x: pointer.worldX - this.originX,
        y: pointer.worldY - this.originY,
      });
      const inBounds =
        tile.col >= 0 && tile.row >= 0 && tile.col < GRID_SIZE && tile.row < GRID_SIZE;
      this.hover.setTile(inBounds ? tile : null);
    });
    this.drawTree();
    this.avatar = createSelfAvatar(this);
    this.placeAvatarAt(this.avatarTile);

    // Camera setup: dark sky background, smooth follow with deadzone so the
    // avatar drifts a bit before the camera reacts.
    this.cameras.main.setBackgroundColor(PALETTE.sky);
    this.cameras.main.startFollow(this.avatar.container, true, 0.15, 0.15);
    this.cameras.main.setDeadzone(160, 120);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));

    this.exposeTestApi();
    this.updateHud();
    if (!this.scene.isActive("hud")) this.scene.launch("hud");
    this.applyInitialSettings();
    this.wireSettingsEvents();
    this.setNetState("offline");
    this.events.emit("self-hp", 10, 10);

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
      this.setNetState("offline");
      return;
    }
    this.setNetState("online");
    this.avatar.container.setVisible(false);
    this.net.onPlayerAdd((snap) => this.upsertRemote(snap.id, snap.col, snap.row));
    this.net.onPlayerChange((snap) => this.upsertRemote(snap.id, snap.col, snap.row));
    this.net.onPlayerRemove((id) => this.removeRemote(id));
    this.net.onMobAdd((snap) => this.upsertMob(snap.id, snap.col, snap.row, snap.hp, snap.hpMax));
    this.net.onMobChange((snap) => this.upsertMob(snap.id, snap.col, snap.row, snap.hp, snap.hpMax));
    this.net.onMobRemove((id) => this.removeMob(id));
  }

  private upsertMob(id: string, col: number, row: number, hp: number, hpMax: number): void {
    const screen = tileToScreen({ col, row });
    const x = this.originX + screen.x;
    const y = this.originY + screen.y;
    const existing = this.mobs.get(id);
    if (existing === undefined) {
      const visual = createWolf(this);
      visual.setPos(x, y);
      visual.setHp(hp, hpMax);
      this.mobs.set(id, { visual, hp });
      return;
    }
    if (hp < existing.hp) {
      hitFlash(this, existing.visual.container);
      floatText(this, x, y - 20, `-${existing.hp - hp}`, "#ffffff");
    }
    existing.hp = hp;
    existing.visual.setHp(hp, hpMax);
    this.tweens.add({
      targets: existing.visual.container,
      x,
      y,
      duration: REMOTE_INTERP_MS,
      ease: "Linear",
    });
  }

  private removeMob(id: string): void {
    const existing = this.mobs.get(id);
    if (existing === undefined) return;
    existing.visual.flashHit(this);
    this.time.delayedCall(200, () => existing.visual.destroy());
    this.mobs.delete(id);
  }

  private upsertRemote(id: string, col: number, row: number): void {
    const screen = tileToScreen({ col, row });
    const x = this.originX + screen.x;
    const y = this.originY + screen.y;
    let visual = this.remotes.get(id);
    if (visual === undefined) {
      const isSelf = id === this.net?.selfId;
      visual = isSelf ? createSelfAvatar(this) : createRemoteAvatar(this, id.slice(0, 4));
      visual.setPos(x, y);
      this.remotes.set(id, visual);
      return;
    }
    this.tweens.add({
      targets: visual.container,
      x,
      y,
      duration: REMOTE_INTERP_MS,
      ease: "Linear",
    });
  }

  private removeRemote(id: string): void {
    const visual = this.remotes.get(id);
    if (visual !== undefined) visual.destroy();
    this.remotes.delete(id);
  }

  private drawGrid(): void {
    drawTileGrid(
      this,
      { x: this.originX, y: this.originY },
      this.grid,
      { size: GRID_SIZE, checker: true, edgeHighlight: true },
    );
  }

  private drawTree(): void {
    const s = tileToScreen(TREE_TILE);
    this.tree = createTree(this, this.originX + s.x, this.originY + s.y);
  }

  private placeAvatarAt(tile: TileCoord): void {
    const s = tileToScreen(tile);
    this.avatar.setPos(this.originX + s.x, this.originY + s.y);
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    clickRing(this, pointer.worldX, pointer.worldY);
    const tile = screenToTile({
      x: pointer.worldX - this.originX,
      y: pointer.worldY - this.originY,
    });

    if (tile.col === TREE_TILE.col && tile.row === TREE_TILE.row) {
      this.chop();
      return;
    }

    if (this.net !== null) {
      if (!this.grid.isWalkable(tile.col, tile.row)) return;
      this.net.sendMoveTo(tile.col, tile.row);
      return;
    }

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
    this.tree.chopBounce(this);
    const treeS = tileToScreen(TREE_TILE);
    const treeCx = this.originX + treeS.x;
    const treeCy = this.originY + treeS.y;
    chopBurst(this, treeCx, treeCy);
    floatText(this, treeCx, treeCy - 28, "+1 wood");
    return "ok";
  }

  private updateHud(): void {
    const el = document.getElementById("hud-wood");
    if (el !== null) el.textContent = String(this.wood);
  }

  private setNetState(state: "online" | "offline"): void {
    this.events.emit("net-state", state);
    const dot = document.getElementById("hud-conn");
    if (dot !== null) dot.setAttribute("data-state", state);
  }

  private walk(steps: TileCoord[]): void {
    this.moving = true;
    this.avatar.setWalking(true);
    let i = 0;
    const next = (): void => {
      if (i >= steps.length) {
        this.moving = false;
        this.avatar.setWalking(false);
        return;
      }
      const target = steps[i++]!;
      const s = tileToScreen(target);
      this.tweens.add({
        targets: this.avatar.container,
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

  // --- Settings wiring --------------------------------------------------

  private applyInitialSettings(): void {
    const s = getCurrentSettings();
    this.applySetting("zoom", s.zoom);
    this.applySetting("showNameTags", s.showNameTags);
    this.applySetting("reduceMotion", s.reduceMotion);
  }

  private wireSettingsEvents(): void {
    const onSetting = (e: Event): void => {
      const detail = (e as CustomEvent).detail as { key: keyof TarnSettings; value: TarnSettings[keyof TarnSettings] };
      this.applySetting(detail.key, detail.value);
    };
    const onAction = (e: Event): void => {
      const detail = (e as CustomEvent).detail as { action: string };
      if (detail.action === "reset-position") this.resetPosition();
    };
    document.addEventListener("tarn:setting", onSetting);
    document.addEventListener("tarn:action", onAction);
    // Tear down on scene shutdown so dev hot-reloads don't pile up handlers.
    this.events.once("shutdown", () => {
      document.removeEventListener("tarn:setting", onSetting);
      document.removeEventListener("tarn:action", onAction);
    });
  }

  private applySetting<K extends keyof TarnSettings>(key: K, value: TarnSettings[K]): void {
    if (key === "zoom" && typeof value === "number") {
      this.cameras.main.setZoom(value);
    } else if (key === "showNameTags" && typeof value === "boolean") {
      for (const v of this.remotes.values()) v.setNameTagVisible(value);
    } else if (key === "reduceMotion" && typeof value === "boolean") {
      this.avatar.setReduceMotion(value);
      for (const v of this.remotes.values()) v.setReduceMotion(value);
    }
  }

  private resetPosition(): void {
    const spawn: TileCoord = { col: 1, row: 1 };
    this.avatarTile = spawn;
    this.placeAvatarAt(spawn);
    this.avatar.setWalking(false);
    if (this.net !== null) this.net.sendMoveTo(spawn.col, spawn.row);
  }
}
