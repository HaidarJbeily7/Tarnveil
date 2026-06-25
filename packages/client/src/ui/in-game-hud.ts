/**
 * In-world HUD overlay — mounted on the default game route. F1 + F2:
 * every panel attaches into a fixed region from HudLayout; nothing
 * positions itself. The world canvas is interactive in the gaps.
 *
 * Layout (per UI_FIX_SPEC):
 *   topLeft       compact resource readout (incl. #hud-wood for the
 *                 chop e2e back-compat) + connection-status dot
 *   topRight      minimap + zone + coords + online count
 *   bottomLeft    vitals (single HP bar) + 5 skill XP rows
 *   bottomCenter  10-slot hotbar
 *   bottomRight   currency cluster (Gold + Token, tabular mono)
 *   rightEdge     collapsible chat strip (collapsed by default)
 */

import { createBar, createIcon, createPanel, createSlot } from "./components/index.js";
import type { IconSlug } from "./components/icon.js";
import { createHudLayout, type HudLayoutHandle } from "./HudLayout.js";
import "./HudLayout.css";
import "./in-game-hud.css";

export interface HudState {
  hp: number;
  hpMax: number;
  gold: number;
  token: number;
  online: number;
  zone: string;
  position: { col: number; row: number };
  wood: number;
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
  wood: 0,
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
  layout: HudLayoutHandle;
  setState(next: Partial<HudState>): void;
  destroy(): void;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US").replace(/,/g, " ");
}

function markPanel(el: HTMLElement, kind: string): HTMLElement {
  el.setAttribute("data-panel", kind);
  return el;
}

export function mountInGameHud(target: HTMLElement = document.body): HudHandle {
  const layout = createHudLayout(target);
  let state: HudState = { ...DEFAULT_HUD_STATE };

  // --- topLeft: compact resource readout ---
  const tl = createPanel({ ariaLabel: "resources" });
  markPanel(tl, "resources");
  tl.classList.add("hud-resources");
  const woodRow = document.createElement("div");
  woodRow.className = "hud-resources__row";
  const woodIcon = createIcon({ slug: "wood-pile", size: 16, ariaLabel: "wood" });
  const woodLabel = document.createElement("span");
  woodLabel.className = "hud-resources__label";
  woodLabel.textContent = "Wood";
  const woodValue = document.createElement("span");
  woodValue.id = "hud-wood";
  woodValue.className = "t-num t-num--sm";
  woodValue.textContent = String(state.wood);
  const connDot = document.createElement("span");
  connDot.id = "hud-conn";
  connDot.className = "hud-resources__conn";
  connDot.setAttribute("data-state", "offline");
  connDot.setAttribute("title", "connection status");
  woodRow.appendChild(woodIcon);
  woodRow.appendChild(woodLabel);
  woodRow.appendChild(woodValue);
  woodRow.appendChild(connDot);
  tl.appendChild(woodRow);
  layout.attach("topLeft", tl);

  // --- topRight: minimap ---
  const minimap = createPanel({ ariaLabel: "minimap" });
  markPanel(minimap, "minimap");
  minimap.classList.add("hud-minimap");
  const map = document.createElement("div");
  map.className = "hud-minimap__canvas";
  map.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "hud-minimap__dot";
  map.appendChild(dot);
  minimap.appendChild(map);
  const mmStats = document.createElement("div");
  mmStats.className = "hud-minimap__stats t-num t-num--sm";
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
  layout.attach("topRight", minimap);

  // --- bottomLeft: vitals (HP + skills) ---
  const vitals = createPanel({ ariaLabel: "vitals and skills" });
  markPanel(vitals, "vitals");
  vitals.classList.add("hud-vitals");

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
  skillsWrap.className = "hud-vitals__skills";
  skillsWrap.setAttribute("data-testid", "hud-skills");
  for (const s of state.skills) {
    const skillRow = document.createElement("div");
    skillRow.className = "hud-vitals__skill-row";
    const icon = createIcon({ slug: skillIcon(s.id), size: 14, ariaLabel: s.label });
    icon.classList.add("hud-vitals__skill-icon");
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
  layout.attach("bottomLeft", vitals);

  // --- bottomCenter: hotbar ---
  const hotbar = createPanel({ ariaLabel: "hotbar" });
  markPanel(hotbar, "hotbar");
  hotbar.classList.add("hud-hotbar");
  const hotbarInner = document.createElement("div");
  hotbarInner.className = "hud-hotbar__row";
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
      const icon = createIcon({ slug: slot.slug, size: 24, ariaLabel: slot.label });
      cell.insertBefore(icon, cell.firstChild);
    }
    const hint = document.createElement("span");
    hint.className = "hud-hotbar__hint";
    hint.textContent = String((i + 1) % 10);
    cell.appendChild(hint);
    hotbarInner.appendChild(cell);
    hotbarSlots.push(cell);
  }
  hotbar.appendChild(hotbarInner);
  layout.attach("bottomCenter", hotbar);

  // --- bottomRight: currency ---
  const currency = createPanel({ ariaLabel: "currency" });
  markPanel(currency, "currency");
  currency.classList.add("hud-currency");
  const goldRow = makeCurrencyRow("coins", "Gold", state.gold);
  goldRow.row.setAttribute("data-testid", "hud-gold");
  goldRow.value.classList.add("hud-currency--gold");
  currency.appendChild(goldRow.row);
  const tokenRow = makeCurrencyRow("shield", "Token", state.token);
  tokenRow.row.setAttribute("data-testid", "hud-token");
  tokenRow.value.classList.add("hud-currency--token");
  currency.appendChild(tokenRow.row);
  layout.attach("bottomRight", currency);

  // --- rightEdge: collapsible chat strip (collapsed by default) ---
  const chat = createPanel({ ariaLabel: "chat" });
  markPanel(chat, "chat");
  chat.classList.add("hud-chat");
  chat.setAttribute("data-collapsed", "true");
  const chatToggle = document.createElement("button");
  chatToggle.type = "button";
  chatToggle.className = "hud-chat__toggle";
  chatToggle.setAttribute("aria-expanded", "false");
  chatToggle.innerHTML = '<span>Chat</span><span class="hud-chat__chev" aria-hidden="true">▾</span>';
  chatToggle.addEventListener("click", () => {
    const collapsed = chat.getAttribute("data-collapsed") === "true";
    chat.setAttribute("data-collapsed", collapsed ? "false" : "true");
    chatToggle.setAttribute("aria-expanded", collapsed ? "true" : "false");
  });
  chat.appendChild(chatToggle);
  const chatBody = document.createElement("div");
  chatBody.className = "hud-chat__body";
  const chatHint = document.createElement("p");
  chatHint.className = "hud-chat__hint";
  chatHint.textContent = "Open the chat panel for the full feed.";
  chatBody.appendChild(chatHint);
  chat.appendChild(chatBody);
  layout.attach("rightEdge", chat);

  function setState(next: Partial<HudState>): void {
    state = { ...state, ...next };
    if (next.hp !== undefined || next.hpMax !== undefined) hpBar.setValue(state.hp, state.hpMax);
    if (next.skills !== undefined) {
      state.skills.forEach((s, i) => skillBars[i]?.setValue(s.xp, s.xpNext));
    }
    if (next.gold !== undefined) goldRow.value.textContent = fmt(state.gold);
    if (next.token !== undefined) tokenRow.value.textContent = fmt(state.token);
    if (next.online !== undefined) online.textContent = `${state.online} online`;
    if (next.zone !== undefined) zoneEl.textContent = state.zone;
    if (next.position !== undefined) {
      coords.textContent = `${state.position.col}, ${state.position.row}`;
      const px = (state.position.col / 10) * 100;
      const py = (state.position.row / 10) * 100;
      dot.style.left = `${px}%`;
      dot.style.top = `${py}%`;
    }
    if (next.wood !== undefined) woodValue.textContent = String(state.wood);
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
    layout,
    setState,
    destroy() {
      layout.destroy();
    },
  };
}

function makeCurrencyRow(
  iconSlug: IconSlug,
  label: string,
  value: number,
): { row: HTMLElement; value: HTMLSpanElement } {
  const row = document.createElement("div");
  row.className = "hud-currency__row";
  const icon = createIcon({ slug: iconSlug, size: 16, ariaLabel: label });
  const lbl = document.createElement("span");
  lbl.className = "hud-currency__label";
  lbl.textContent = label;
  const v = document.createElement("span");
  v.className = "hud-currency__value t-num t-num--lg";
  v.textContent = fmt(value);
  row.appendChild(icon);
  row.appendChild(lbl);
  row.appendChild(v);
  return { row, value: v };
}

function skillIcon(id: string): IconSlug {
  switch (id) {
    case "woodcutting": return "wood-axe";
    case "mining": return "pickaxe";
    case "fishing": return "fishing-rod";
    case "cooking": return "cooking-pot";
    case "combat": return "shield";
    default: return "skills";
  }
}
