import Phaser from "phaser";
import { GAME } from "@tarnveil/shared/game.config";
import { BootScene } from "./scenes/BootScene";

document.title = GAME.name;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 1024,
  height: 576,
  backgroundColor: "#1a1a1a",
  scene: [BootScene],
};

new Phaser.Game(config);
