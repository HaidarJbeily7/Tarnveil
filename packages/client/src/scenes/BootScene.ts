import Phaser from "phaser";
import { GAME } from "@tarnveil/shared/game.config";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, GAME.name, {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }
}
