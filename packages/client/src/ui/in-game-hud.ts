/**
 * In-world HUD overlay — mounted on game routes (default). All edge-anchored,
 * translucent, never centre-screen; the world stays visible behind it.
 * Reads from a small HudState; WorldScene events nudge state mutations
 * later. For now we expose the data structure + render so design + a11y
 * can be reviewed.
 */

import { createBar, createIcon, createPanel, createSlot } from "./components/index.js";
import type { IconSlug } from "./components/icon.js";
import "./in-game-hud.css";

export interface HudState {
  hp: number;
  hpMax: number;
  gold: number;
  token: number;
  online: number;
  zone: string;
  position: { col: number; row: number };
  hotbar: Array<{ slug: IconSlug; qty?: number; label: string } | null>;
  skills: Array<{ id: string; label: string; level: number; xp: number; xpNext: number }>;
}

export const DEFAULT_HUD_STATE: HudState = {
  hp: 10,
  hpMax: 10,
  gold: 0,
  token: 0,
  online: 1,
  zone: "Mainland",
  position: { col: 1, row: 1 },
  hotbar: [
    { slug: "wood-axe", label: "Wood axe" },
    { slug: "pickaxe", label: "Pickaxe" },
    { slug: "fishing-rod", label: "Fishing rod" },
    { slug: "wood-pile", label: "Wood", qty: 0 },
    { slug: "rock", label: "Stone", qty: 0 },
    { slug: "cooking-pot", label: "Cooking pot" },
    null,
    null,
    null,
    null,
  ],
  skills: [
    { id: "combat", label: "Combat", level: 1, xp: 0, xpNext: 100 },
    { id: "woodcutting", label: "Woodcutting", level: 1, xp: 0, xpNext: 100 },
    { id: "mining", label: "Mining", level: 1, xp: 0, xpNext: 100 },
    { id: "fishing", label: "Fishing", level: 1, xp: 0, xpNext: 100 },
    { id: "cooking", label: "Cooking", level: 1, xp: 0, xpNext: 100 },
  ],
};

export interface HudHandle {
  root: HTMLElement;
  setState(next: Partial<HudState>): void;
  destroy(): void;
}

/** Format a number with thin-space thousands separators for readability. */
function fmt(n: number): string {
  return n.toLocaleString("en-US").replace(/,/g, " ");
}

export function mountInGameHud(target: HTMLElement = document.body): HudHandle {
  const root = document.createElement("div");
  root.id = "ingame-hud";
  root.setAttribute("data-testid", "ingame-hud");

  let state: HudState = { ...DEFAULT_HUD_STATE };

  // --- Vitals: HP + skill bars (bottom-left) ---
  const vitals = createPanel({ ariaLabel: "vitals and skills" });
  vitals.classList.add("ingame-hud__vitals");

  const hpBar = createBar({
    value: state.hp,
    max: state.hpMax,
    variant: "hp",
    label: "Health",
    showNumbers: true,
  });
  hpBar.root.setAttribute("data-testid", "hud-hp");
  vitals.appendChild(hpBar.root);

  const skillBars: Array<ReturnType<typeof createBar>> = [];
  const skillsWrap = document.createElement("div");
  skillsWrap.className = "ingame-hud__skills";
  skillsWrap.setAttribute("data-testid", "hud-skills");
  for (const s of state.skills) {
    const skillRow = document.createElement("div");
    skillRow.className = "ingame-hud__skill-row";
    const icon = createIcon({
      slug: skillIcon(s.id),
      size: 16,
      ariaLabel: s.label,
    });
    icon.classList.add("ingame-hud__skill-icon");
    const bar = createBar({
      value: s.xp,
      max: s.xpNext,
      variant: "reed",
      showNumbers: false,
      label: `${s.label} L${s.level}`,
    });
    bar.root.setAttribute("data-skill", s.id);
    skillBars.push(bar);
    skillRow.appendChild(icon);
    skillRow.appendChild(bar.root);
    skillsWrap.appendChild(skillRow);
  }
  vitals.appendChild(skillsWrap);
  root.appendChild(vitals);

  // --- Hotbar (bottom-center) ---
  const hotbar = createPanel({ ariaLabel: "hotbar" });
  hotbar.classList.add("ingame-hud__hotbar");
  const hotbarInner = document.createElement("div");
  hotbarInner.className = "ingame-hud__hotbar-row";
  hotbarInner.setAttribute("data-testid", "hud-hotbar");
  hotbarInner.setAttribute("role", "toolbar");
  hotbarInner.setAttribute("aria-label", "hotbar");
  const hotbarSlots: HTMLElement[] = [];
  for (let i = 0; i < 10; i++) {
    const slot = state.hotbar[i];
    const slotOpts: { ariaLabel: string; qty?: number } = {
      ariaLabel: slot === null ? `Empty slot ${i + 1}` : `${slot.label}${slot.qty !== undefined ? ` x${slot.qty}` : ""}`,
    };
    if (slot?.qty !== undefined) slotOpts.qty = slot.qty;
    const cell = createSlot(slotOpts);
    cell.setAttribute("data-hotbar-index", String(i));
    if (slot !== null) {
      const icon = createIcon({ slug: slot.slug, size: 28, ariaLabel: slot.label });
      cell.insertBefore(icon, cell.firstChild);
    }
    // Keyboard hint (1..0)
    const hint = document.createElement("span");
    hint.className = "ingame-hud__slot-hint";
    hint.textContent = String((i + 1) % 10);
    cell.appendChild(hint);
    hotbarInner.appendChild(cell);
    hotbarSlots.push(cell);
  }
  hotbar.appendChild(hotbarInner);
  root.appendChild(hotbar);

  // --- Currency cluster (bottom-right) ---
  const currency = createPanel({ ariaLabel: "currency" });
  currency.classList.add("ingame-hud__currency");

  const goldRow = makeCurrencyRow("coins", "Gold", state.gold);
  goldRow.row.setAttribute("data-testid", "hud-gold");
  goldRow.value.classList.add("ingame-hud__currency--gold");
  currency.appendChild(goldRow.row);

  const tokenRow = makeCurrencyRow("shield", "Token", state.token);
  tokenRow.row.setAttribute("data-testid", "hud-token");
  tokenRow.value.classList.add("ingame-hud__currency--token");
  currency.appendChild(tokenRow.row);

  root.appendChild(currency);

  // --- Minimap (top-right) ---
  const minimap = createPanel({ ariaLabel: "minimap" });
  minimap.classList.add("ingame-hud__minimap");
  const map = document.createElement("div");
  map.className = "ingame-hud__minimap-canvas";
  map.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "ingame-hud__minimap-dot";
  map.appendChild(dot);
  minimap.appendChild(map);
  const mmStats = document.createElement("div");
  mmStats.className = "ingame-hud__minimap-stats t-num t-num--sm";
  const zoneEl = document.createElement("span");
  zoneEl.setAttribute("data-testid", "hud-zone");
  zoneEl.textContent = state.zone;
  const coords = document.createElement("span");
  coords.setAttribute("data-testid", "hud-coords");
  coords.textContent = `${state.position.col}, ${state.position.row}`;
  const online = document.createElement("span");
  online.setAttribute("data-testid", "hud-online");
  online.textContent = `${state.online} online`;
  mmStats.appendChild(zoneEl);
  mmStats.appendChild(coords);
  mmStats.appendChild(online);
  minimap.appendChild(mmStats);
  root.appendChild(minimap);

  target.appendChild(root);

  function setState(next: Partial<HudState>): void {
    state = { ...state, ...next };
    if (next.hp !== undefined || next.hpMax !== undefined) {
      hpBar.setValue(state.hp, state.hpMax);
    }
    if (next.skills !== undefined) {
      state.skills.forEach((s, i) => {
        skillBars[i]?.setValue(s.xp, s.xpNext);
      });
    }
    if (next.gold !== undefined) goldRow.value.textContent = fmt(state.gold);
    if (next.token !== undefined) tokenRow.value.textContent = fmt(state.token);
    if (next.online !== undefined) online.textContent = `${state.online} online`;
    if (next.zone !== undefined) zoneEl.textContent = state.zone;
    if (next.position !== undefined) {
      coords.textContent = `${state.position.col}, ${state.position.row}`;
      // Move the player dot proportionally inside the minimap canvas (10x10).
      const px = (state.position.col / 10) * 100;
      const py = (state.position.row / 10) * 100;
      dot.style.left = `${px}%`;
      dot.style.top = `${py}%`;
    }
    if (next.hotbar !== undefined) {
      next.hotbar.forEach((slot, i) => {
        const cell = hotbarSlots[i];
        if (cell === undefined) return;
        const qty = cell.querySelector(".slot__qty");
        if (qty !== null) qty.remove();
        if (slot?.qty !== undefined && slot.qty > 1) {
          const q = document.createElement("span");
          q.className = "slot__qty";
          q.textContent = String(slot.qty);
          cell.appendChild(q);
        }
      });
    }
  }

  return {
    root,
    setState,
    destroy() {
      root.remove();
    },
  };
}

function makeCurrencyRow(
  iconSlug: IconSlug,
  label: string,
  value: number,
): { row: HTMLElement; value: HTMLSpanElement } {
  const row = document.createElement("div");
  row.className = "ingame-hud__currency-row";
  const icon = createIcon({ slug: iconSlug, size: 16, ariaLabel: label });
  const lbl = document.createElement("span");
  lbl.className = "ingame-hud__currency-label";
  lbl.textContent = label;
  const v = document.createElement("span");
  v.className = "ingame-hud__currency-value t-num t-num--lg";
  v.textContent = fmt(value);
  row.appendChild(icon);
  row.appendChild(lbl);
  row.appendChild(v);
  return { row, value: v };
}

function skillIcon(id: string): IconSlug {
  switch (id) {
    case "woodcutting":
      return "wood-axe";
    case "mining":
      return "pickaxe";
    case "fishing":
      return "fishing-rod";
    case "cooking":
      return "cooking-pot";
    case "combat":
      return "shield";
    default:
      return "skills";
  }
}
