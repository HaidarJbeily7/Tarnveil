import Phaser from "phaser";

/**
 * Tiny launcher scene. Phaser starts with the first scene in the array, so
 * the moment this runs we hand off to WorldScene. Kept separate so future
 * preloads (atlases, audio) land here without growing WorldScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.scene.start("world");
  }
}
