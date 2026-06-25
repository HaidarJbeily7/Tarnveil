import Phaser from "phaser";
import { GAME } from "@tarnveil/shared/game.config";
import { BootScene } from "./scenes/BootScene";
import { HudScene } from "./scenes/HudScene";
import { WorldScene } from "./scenes/WorldScene";
import { wireSettingsPanel } from "./settings";

document.title = GAME.name;
// Mirror the configured game name into the HTML chrome so R8 stays clean
// (the literal lives only in GAME.name).
const nameEl = document.getElementById("hud-name");
if (nameEl !== null) nameEl.textContent = GAME.name;
wireSettingsPanel();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  backgroundColor: "#1a1a1a",
  scene: [BootScene, WorldScene, HudScene],
};

new Phaser.Game(config);
