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
} else if (ui === "skills") {
  // Phase C7 — skills progression panel.
  void import("./ui/screens/skills.js").then((m) => m.mountSkills());
} else if (ui === "inventory") {
  // Phase C5 — inventory grid.
  void import("./ui/screens/inventory.js").then((m) => m.mountInventory());
} else if (ui === "chat") {
  // Phase C10 — multi-channel chat panel.
  void import("./ui/screens/chat-panel.js").then((m) => m.mountChatPanel());
} else if (ui === "combat") {
  // Phase C8 — gathering / combat feedback showcase.
  void import("./ui/screens/combat.js").then((m) => m.mountCombat());
} else if (ui === "quests") {
  // Phase C11 — daily quests panel.
  void import("./ui/screens/quests.js").then((m) => m.mountQuests());
} else if (ui === "market") {
  // Phase C9 — marketplace + gold↔token bridge.
  void import("./ui/screens/market.js").then((m) => m.mountMarket());
} else if (ui === "bank") {
  // Phase C6 — bank + equipment / character sheet.
  void import("./ui/screens/bank.js").then((m) => m.mountBank());
} else if (ui === "friends") {
  // Phase C12 — friends + presence + DMs.
  void import("./ui/screens/friends.js").then((m) => m.mountFriends());
} else if (ui === "settings-tabs") {
  // Phase C14 — settings with accessibility tabs.
  void import("./ui/screens/settings-tabs.js").then((m) => m.mountSettingsTabs());
} else if (ui === "loading") {
  // Phase C15 — branded loading screen + zone transition.
  void import("./ui/screens/loading.js").then((m) => m.mountLoading());
} else {
  // Default route — boot the Phaser game and the in-world HUD overlay (C4).
  void import("./ui/in-game-hud.js").then((m) => {
    const handle = m.mountInGameHud();
    handle.setState({ gold: 0, token: 0, position: { col: 1, row: 1 } });
  });
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
