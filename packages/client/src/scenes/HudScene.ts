import Phaser from "phaser";
import { PALETTE } from "../render/palette.js";
import { GAME } from "@tarnveil/shared/game.config";

type NetState = "online" | "offline";

/**
 * Overlay scene rendered above WorldScene. Holds in-canvas HUD chrome that
 * doesn't move with the camera: HP bar, connection-status dot, and a small
 * title strip in the top-left.
 */
export class HudScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private connDot!: Phaser.GameObjects.Arc;
  private hp = 10;
  private hpMax = 10;

  constructor() {
    super("hud");
  }

  create(): void {
    const world = this.scene.get("world");

    // Top-left title chip — the canvas-overlay title was dropped from
    // WorldScene in step 5; this is the in-canvas replacement.
    this.add
      .text(12, 10, GAME.name, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(10);

    // HP bar — bottom-left.
    this.hpBar = this.add.graphics().setDepth(10);
    this.drawHpBar();

    // Connection-status dot — top-right.
    this.connDot = this.add.circle(this.scale.width - 18, 18, 6, 0x8a8a8a, 1);
    this.connDot.setStrokeStyle(1, 0x000000, 0.6).setDepth(10);

    world.events.on("self-hp", (hp: number, max: number) => {
      this.hp = hp;
      this.hpMax = max;
      this.drawHpBar();
    });
    world.events.on("net-state", (state: NetState) => {
      this.connDot.setFillStyle(state === "online" ? 0x66cc66 : 0xcc6666);
    });

    // Reposition + redraw on resize so Scale.FIT (step 8) keeps the HUD edges.
    this.scale.on("resize", () => {
      this.connDot.setPosition(this.scale.width - 18, 18);
      this.drawHpBar();
    });
  }

  private drawHpBar(): void {
    const x = 12;
    const y = this.scale.height - 22;
    const w = 180;
    const h = 12;
    const ratio = this.hpMax > 0 ? Math.max(0, this.hp / this.hpMax) : 0;
    this.hpBar.clear();
    this.hpBar.fillStyle(PALETTE.hpBg, 0.85);
    this.hpBar.fillRoundedRect(x, y, w, h, 3);
    this.hpBar.fillStyle(PALETTE.hp, 1);
    this.hpBar.fillRoundedRect(x, y, Math.max(2, w * ratio), h, 3);
    this.hpBar.lineStyle(1, 0x000000, 0.5);
    this.hpBar.strokeRoundedRect(x, y, w, h, 3);
  }
}
