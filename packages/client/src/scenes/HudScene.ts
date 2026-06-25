import Phaser from "phaser";

type NetState = "online" | "offline";

/**
 * Empty Phaser overlay scene. UI_FIX_SPEC F2: the in-canvas wordmark,
 * stray HP bar, and connection dot all moved to the DOM HudLayout
 * regions. This scene survives only as a place to forward world events
 * for callers that still care (HudScene::events bridge).
 */
export class HudScene extends Phaser.Scene {
  constructor() {
    super("hud");
  }

  create(): void {
    const world = this.scene.get("world");
    // Bridge: forward `self-hp` and `net-state` to the document so the
    // DOM HUD can react. We don't render anything in-canvas anymore.
    world.events.on("self-hp", (hp: number, max: number) => {
      document.dispatchEvent(
        new CustomEvent("tarn:hud", { detail: { kind: "hp", hp, max } }),
      );
    });
    world.events.on("net-state", (state: NetState) => {
      document.dispatchEvent(
        new CustomEvent("tarn:hud", { detail: { kind: "net", state } }),
      );
    });
  }
}
