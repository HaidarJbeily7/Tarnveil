import Phaser from "phaser";
import { GAME } from "@tarnveil/shared/game.config";
import { BootScene } from "./scenes/BootScene";
import { HudScene } from "./scenes/HudScene";
import { WorldScene } from "./scenes/WorldScene";
import { wireSettingsPanel } from "./settings";

// Design system — load tokens, typography, and component CSS up front so
// any DOM chrome (HUD, gallery, future C-phase screens) styles correctly.
import "./ui/theme.css";
import "./ui/type.css";
import "./ui/components/components.css";

document.title = GAME.name;
// Mirror the configured game name into the HTML chrome so R8 stays clean
// (the literal lives only in GAME.name).
const nameEl = document.getElementById("hud-name");
if (nameEl !== null) nameEl.textContent = GAME.name;
wireSettingsPanel();

const params = new URLSearchParams(window.location.search);

const ui = params.get("ui");

if (ui === "gallery") {
  // Phase A3 gallery route — every component primitive rendered at least
  // once, with a caption. Used by the e2e gallery spec.
  void import("./ui/gallery.js").then((m) => m.mountGallery());
} else if (ui === "landing") {
  // Phase C1 — marketing landing screen with live spectate chat.
  void import("./ui/screens/landing.js").then((m) => m.mountLanding());
} else if (ui === "connect") {
  // Phase C2 — wallet sign-in screen with state machine.
  void import("./ui/screens/connect.js").then((m) => m.mountConnect());
} else if (ui === "character") {
  // Phase C3 — character select / create.
  void import("./ui/screens/character.js").then((m) => m.mountCharacter());
} else {
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
}
