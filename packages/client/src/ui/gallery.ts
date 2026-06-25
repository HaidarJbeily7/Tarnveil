import { GAME } from "@tarnveil/shared/game.config";
import {
  attachTooltip,
  createBar,
  createButton,
  createPanel,
  createSlot,
  createTabs,
  showToast,
} from "./components/index.js";

/**
 * Component gallery — the "definition of done" for Phase A3. Mounted when
 * the page loads with `?ui=gallery`. Shows every primitive at least once
 * with a caption, and tabbing reaches every interactive control with a
 * visible focus ring.
 */
export function mountGallery(target: HTMLElement = document.body): void {
  const root = document.createElement("div");
  root.className = "gallery";
  root.setAttribute("data-testid", "gallery");

  const h1 = document.createElement("h1");
  h1.className = "t-display t-display--lg";
  h1.textContent = `${GAME.name} — Component Gallery`;
  root.appendChild(h1);

  const sub = document.createElement("p");
  sub.className = "gallery__caption";
  sub.textContent = "Phase A3: lakeglass panel + primitives.";
  root.appendChild(sub);

  // --- Lakeglass Panel ----------------------------------------------------
  root.appendChild(section("Lakeglass Panel"));
  const panelRow = row();
  const p = createPanel({ ariaLabel: "demo panel" });
  p.style.minWidth = "240px";
  const ptitle = document.createElement("div");
  ptitle.className = "t-display t-display--sm";
  ptitle.textContent = "Frosted slate";
  const pbody = document.createElement("p");
  pbody.className = "t-body";
  pbody.textContent = "Backdrop-blur, brass L-corners, mist-glow top edge.";
  p.appendChild(ptitle);
  p.appendChild(pbody);
  panelRow.appendChild(p);
  root.appendChild(panelRow);

  // --- Buttons ------------------------------------------------------------
  root.appendChild(section("Buttons"));
  const btnRow = row();
  btnRow.appendChild(
    createButton({ label: "Enter " + GAME.name, variant: "primary" }),
  );
  btnRow.appendChild(createButton({ label: "Cancel", variant: "secondary" }));
  btnRow.appendChild(createButton({ label: "Drop", variant: "danger" }));
  btnRow.appendChild(
    createButton({ label: "Tiny", variant: "secondary", size: "small" }),
  );
  btnRow.appendChild(
    createButton({ label: "Disabled", variant: "primary", disabled: true }),
  );
  root.appendChild(btnRow);

  // --- Tooltip ------------------------------------------------------------
  root.appendChild(section("Tooltip"));
  const tipRow = row();
  const tipTarget = createButton({ label: "Hover or focus me", variant: "secondary" });
  attachTooltip(tipTarget, "Tooltip text — keyboard reachable via focus.");
  tipRow.appendChild(tipTarget);
  root.appendChild(tipRow);

  // --- Tabs ---------------------------------------------------------------
  root.appendChild(section("Tabs"));
  const tabsRow = row();
  const tabs = createTabs({
    tabs: [
      { id: "world", label: "World" },
      { id: "local", label: "Local" },
      { id: "dms", label: "DMs" },
    ],
  });
  tabsRow.appendChild(tabs.root);
  root.appendChild(tabsRow);

  // --- Slot grid ----------------------------------------------------------
  root.appendChild(section("Inventory slot"));
  const grid = document.createElement("div");
  grid.className = "gallery__grid";
  grid.appendChild(createSlot({ icon: "🪵", qty: 5, ariaLabel: "wood ×5" }));
  grid.appendChild(createSlot({ icon: "🪓", ariaLabel: "wood axe" }));
  grid.appendChild(createSlot({ icon: "🐺", qty: 12, ariaLabel: "hide ×12", selected: true }));
  grid.appendChild(createSlot({ ariaLabel: "empty slot" }));
  grid.appendChild(createSlot({ ariaLabel: "empty slot" }));
  grid.appendChild(createSlot({ ariaLabel: "empty slot" }));
  root.appendChild(grid);

  // --- Bars ---------------------------------------------------------------
  root.appendChild(section("Bars (HP, XP, reed, lantern)"));
  const barWrap = document.createElement("div");
  barWrap.style.display = "grid";
  barWrap.style.gridTemplateColumns = "minmax(200px, 320px)";
  barWrap.style.gap = "12px";
  barWrap.appendChild(createBar({ value: 7, max: 10, variant: "hp", label: "Health" }).root);
  barWrap.appendChild(createBar({ value: 350, max: 1900, variant: "xp", label: "XP" }).root);
  barWrap.appendChild(createBar({ value: 4, max: 5, variant: "reed", label: "Woodcutting" }).root);
  barWrap.appendChild(createBar({ value: 42, max: 100, variant: "lantern", label: "Gold quest" }).root);
  root.appendChild(barWrap);

  // --- Toasts -------------------------------------------------------------
  root.appendChild(section("Toasts (top-right stack)"));
  const toastRow = row();
  toastRow.appendChild(
    createButton({
      label: "Info toast",
      variant: "secondary",
      onClick: () =>
        showToast({ title: "Heads up", message: "An informational message.", tone: "info" }),
    }),
  );
  toastRow.appendChild(
    createButton({
      label: "Success",
      variant: "secondary",
      onClick: () =>
        showToast({ title: "Picked up", message: "+1 wood", tone: "success" }),
    }),
  );
  toastRow.appendChild(
    createButton({
      label: "Danger",
      variant: "danger",
      onClick: () =>
        showToast({ title: "Out of range", message: "Move closer to the tree.", tone: "danger" }),
    }),
  );
  root.appendChild(toastRow);

  target.appendChild(root);
}

function section(title: string): HTMLElement {
  const h = document.createElement("h2");
  h.className = "t-display t-display--sm";
  h.textContent = title;
  return h;
}

function row(): HTMLElement {
  const r = document.createElement("div");
  r.className = "gallery__row";
  return r;
}
