/**
 * F1 — The single HUD layout authority.
 *
 * Every in-world panel renders **into a region** here; nothing positions
 * itself with bespoke top/left coordinates. Regions have fixed anchors and
 * bounded max sizes — panels can't overlap each other or escape the viewport.
 *
 * Z-layering comes from theme tokens (world < hud < panels < modals < toasts);
 * regions live on `--z-hud`, the parent root is pointer-events-none so the
 * world stays interactive between panels.
 */

export type HudRegion =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight"
  | "rightEdge";

export const HUD_REGIONS: ReadonlyArray<HudRegion> = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
  "rightEdge",
];

export interface HudLayoutHandle {
  root: HTMLElement;
  attach(region: HudRegion, element: HTMLElement): void;
  region(name: HudRegion): HTMLElement;
  destroy(): void;
}

export function createHudLayout(target: HTMLElement = document.body): HudLayoutHandle {
  const root = document.createElement("div");
  root.id = "hud-layout";
  root.className = "hud-layout";
  root.setAttribute("data-testid", "hud-layout");

  const regions = new Map<HudRegion, HTMLElement>();
  for (const name of HUD_REGIONS) {
    const r = document.createElement("div");
    r.className = `hud-region hud-region--${name}`;
    r.setAttribute("data-region", name);
    r.setAttribute("role", "group");
    r.setAttribute("aria-label", `${name} HUD region`);
    regions.set(name, r);
    root.appendChild(r);
  }
  target.appendChild(root);

  return {
    root,
    attach(name, el) {
      regions.get(name)?.appendChild(el);
    },
    region(name) {
      const r = regions.get(name);
      if (r === undefined) throw new Error(`unknown HUD region: ${name}`);
      return r;
    },
    destroy() {
      root.remove();
    },
  };
}
