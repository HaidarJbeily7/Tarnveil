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
import { drawScenery } from "../render/scenery.js";
import { drawTileGrid, makeHoverHighlight, type HoverHighlight } from "../render/tiles.js";
import { createTree, type TreeVisual } from "../render/trees.js";
import { getCurrentSettings, type TarnSettings } from "../settings.js";

const GRID_SIZE = 10;
const STEP_MS = 180;
const REMOTE_INTERP_MS = 160;

const TREE_TILE: TileCoord = { col: 5, row: 5 };
const CHOP_RANGE = 1;

export type KeyboardDir = "up" | "down" | "left" | "right";

export interface ChopTestApi {
  getWood(): number;
  attemptChop(): "ok" | "out-of-range";
  setAvatarTile(tile: TileCoord): void;
  treeTile(): TileCoord;
  isNetworked(): boolean;
  getAvatarTile(): TileCoord;
  keyboardStep(dir: KeyboardDir): "ok" | "blocked" | "moving";
}

/**
 * Screen-aligned 4-directional movement on the iso grid. With the standard
 * iso projection where (col, row) maps to ((col-row)*halfW, (col+row)*halfH):
 *
 *   up:    col-1, row-1  → pure up   on screen
 *   down:  col+1, row+1  → pure down on screen
 *   left:  col-1, row+1  → pure left on screen
 *   right: col+1, row-1  → pure right on screen
 *
 * So WASD and arrow keys feel intuitive to a player looking at the canvas,
 * not "isometric tile cardinal" (which would walk diagonally on screen).
 */
const KEY_DELTAS: Record<KeyboardDir, { col: number; row: number }> = {
  up:    { col: -1, row: -1 },
  down:  { col:  1, row:  1 },
  left:  { col: -1, row:  1 },
  right: { col:  1, row: -1 },
};

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
  // Camera zoom math (UI_FIX_2 F3). The user settings zoom is a multiplier
  // on top of `fitZoom`, so a freshly opened window already shows the map
  // at ~90% fill regardless of viewport size.
  private fitZoom = 1.6;
  private mapPixelWidth = 0;
  private mapPixelHeight = 0;
  // Keyboard: WASD + arrow keys for screen-aligned 4-directional movement.
  // A key held past the end of a step triggers another step automatically
  // (see Phaser update loop in continueKeyboardWalk).
  private keys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    Up: Phaser.Input.Keyboard.Key;
    Down: Phaser.Input.Keyboard.Key;
    Left: Phaser.Input.Keyboard.Key;
    Right: Phaser.Input.Keyboard.Key;
  } | null = null;

  constructor() {
    super("world");
  }

  preload(): void {
    // UI_FIX_SPEC F3 + UI_FIX_2 F4 — every world entity loads from a real
    // texture; missing textures fall back to a glaring magenta box via the
    // `sprite()` helper so the asset pipeline can't silently regress.
    this.load.image("world-floor", "/assets/world/floor.png");
    this.load.image("world-floor-alt", "/assets/world/floor-alt.png");
    this.load.image("world-player-idle", "/assets/world/player-idle.png");
    this.load.image("world-remote-idle", "/assets/world/remote-idle.png");
    this.load.image("world-crate", "/assets/world/crate.png");
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

    // The Kenney iso tiles render their own clean diamond edges — no more
    // procedural dirt apron beneath. drawPlaneBase still exists for the
    // graphics fallback path but isn't called when textures load.
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
    // avatar drifts a bit before the camera reacts. The fit-zoom math lives
    // in computeFitZoom() and is re-run on resize so the map keeps filling
    // the viewport when the window changes shape.
    this.mapPixelWidth = GRID_SIZE * DEFAULT_ISO.tileWidth;
    this.mapPixelHeight = GRID_SIZE * DEFAULT_ISO.tileHeight;
    this.cameras.main.setBackgroundColor(PALETTE.sky);
    this.cameras.main.startFollow(this.avatar.container, true, 0.15, 0.15);
    this.cameras.main.setDeadzone(160, 120);
    this.computeFitZoom();
    this.scale.on("resize", this.onResize, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.onResize, this));

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.setupKeyboard();

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
      getAvatarTile: () => ({ ...this.avatarTile }),
      keyboardStep: (dir) => this.keyboardStep(dir),
    };
    (window as unknown as { __tarn?: ChopTestApi }).__tarn = api;
  }

  // --- Keyboard movement ------------------------------------------------

  private setupKeyboard(): void {
    if (this.input.keyboard === null) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = this.input.keyboard;
    this.keys = {
      W:     kb.addKey(K.W),
      A:     kb.addKey(K.A),
      S:     kb.addKey(K.S),
      D:     kb.addKey(K.D),
      Up:    kb.addKey(K.UP),
      Down:  kb.addKey(K.DOWN),
      Left:  kb.addKey(K.LEFT),
      Right: kb.addKey(K.RIGHT),
    };
    // Stop the browser from scrolling the page when arrows are pressed.
    kb.addCapture([K.UP, K.DOWN, K.LEFT, K.RIGHT, K.W, K.A, K.S, K.D]);
  }

  update(): void {
    if (this.moving || this.keys === null) return;
    const dir = this.heldDirection();
    if (dir !== null) this.keyboardStep(dir);
  }

  private heldDirection(): KeyboardDir | null {
    const k = this.keys;
    if (k === null) return null;
    if (k.W.isDown || k.Up.isDown) return "up";
    if (k.S.isDown || k.Down.isDown) return "down";
    if (k.A.isDown || k.Left.isDown) return "left";
    if (k.D.isDown || k.Right.isDown) return "right";
    return null;
  }

  private keyboardStep(dir: KeyboardDir): "ok" | "blocked" | "moving" {
    if (this.moving) return "moving";
    const delta = KEY_DELTAS[dir];
    const next: TileCoord = {
      col: this.avatarTile.col + delta.col,
      row: this.avatarTile.row + delta.row,
    };
    if (
      next.col < 0 || next.row < 0 ||
      next.col >= GRID_SIZE || next.row >= GRID_SIZE ||
      !this.grid.isWalkable(next.col, next.row)
    ) {
      return "blocked";
    }
    if (this.net !== null) {
      this.net.sendMoveTo(next.col, next.row);
      // Optimistic local tile bookkeeping so the next keyboardStep math
      // is relative to where we just headed (the server snapshot will
      // confirm shortly).
      this.avatarTile = next;
      return "ok";
    }
    this.walk([next]);
    return "ok";
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
      // User setting is a multiplier — 1.0 means "the auto-fit zoom",
      // not literal 1× pixels. Otherwise a default install would show
      // the map as a small island floating in black.
      this.cameras.main.setZoom(this.fitZoom * value);
    } else if (key === "showNameTags" && typeof value === "boolean") {
      for (const v of this.remotes.values()) v.setNameTagVisible(value);
    } else if (key === "reduceMotion" && typeof value === "boolean") {
      this.avatar.setReduceMotion(value);
      for (const v of this.remotes.values()) v.setReduceMotion(value);
    }
  }

  private computeFitZoom(): void {
    const vw = this.scale.width;
    const vh = this.scale.height;
    if (vw <= 0 || vh <= 0 || this.mapPixelWidth <= 0 || this.mapPixelHeight <= 0) return;
    const base = Math.min(vw / this.mapPixelWidth, vh / this.mapPixelHeight) * 0.9;
    this.fitZoom = Phaser.Math.Clamp(base, 1.4, 3);
    // Re-apply with the current user multiplier so resize keeps the fit.
    const userZoom = getCurrentSettings().zoom;
    this.cameras.main.setZoom(this.fitZoom * userZoom);
  }

  private onResize(): void {
    this.computeFitZoom();
  }

  private resetPosition(): void {
    const spawn: TileCoord = { col: 1, row: 1 };
    this.avatarTile = spawn;
    this.placeAvatarAt(spawn);
    this.avatar.setWalking(false);
    if (this.net !== null) this.net.sendMoveTo(spawn.col, spawn.row);
  }
}
