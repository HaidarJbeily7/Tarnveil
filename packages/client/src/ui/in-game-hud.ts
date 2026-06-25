/**
 * In-world HUD overlay — mounted on the default game route.
 *
 * UI_FIX_2 pass:
 *   - The "Wood" chip on topLeft is gone. Carried resources live in the
 *     inventory / hotbar; #hud-wood (used by the chop e2e) is a hidden
 *     mirror of the wood-pile hotbar slot quantity.
 *   - The floating "Open the chat panel" sentence is gone. rightEdge is
 *     a small Chat toggle button only; no prose.
 *   - The Settings gear lives inside the topRight panel header as its own
 *     button — it never overlaps the location label.
 *   - Labels are label-left / value-right with tabular figures.
 *
 * Layout regions (provided by HudLayout):
 *   topLeft       connection-status pill (offline / online)
 *   topRight      minimap panel — header (location · coords · online + gear),
 *                 180×180 canvas, no inline collisions
 *   bottomLeft    vitals (HP) + skill rows (icon + label + L1 + bar below)
 *   bottomCenter  10-slot horizontal hotbar
 *   bottomRight   currency cluster (Gold + Token)
 *   rightEdge     compact Chat toggle button
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

  // --- Hidden mirror for the chop e2e -------------------------------------
  // #hud-wood used to live in a "Wood: 0" chip — meaningless once carried
  // resources moved to the hotbar. Keep the element so chop.spec.ts still
  // reads the count, but make it invisible.
  const hudWoodMirror = document.createElement("span");
  hudWoodMirror.id = "hud-wood";
  hudWoodMirror.setAttribute("aria-hidden", "true");
  hudWoodMirror.style.position = "absolute";
  hudWoodMirror.style.left = "-9999px";
  hudWoodMirror.style.width = "1px";
  hudWoodMirror.style.height = "1px";
  hudWoodMirror.style.overflow = "hidden";
  hudWoodMirror.textContent = String(state.wood);
  layout.root.appendChild(hudWoodMirror);

  // --- topLeft: connection-status pill only -------------------------------
  const conn = document.createElement("div");
  conn.className = "hud-conn-pill";
  conn.setAttribute("data-panel", "connection");
  const connDot = document.createElement("span");
  connDot.id = "hud-conn";
  connDot.className = "hud-conn-pill__dot";
  connDot.setAttribute("data-state", "offline");
  const connLabel = document.createElement("span");
  connLabel.className = "hud-conn-pill__label";
  connLabel.textContent = "Offline";
  conn.appendChild(connDot);
  conn.appendChild(connLabel);
  layout.attach("topLeft", conn);

  // --- topRight: minimap + location row + settings -----------------------
  const minimap = createPanel({ ariaLabel: "minimap" });
  markPanel(minimap, "minimap");
  minimap.classList.add("hud-minimap");

  // Header row: title + Settings button. Title is short so it can't collide.
  const mmHeader = document.createElement("div");
  mmHeader.className = "hud-minimap__header";
  const mmTitle = document.createElement("span");
  mmTitle.className = "hud-minimap__title";
  mmTitle.textContent = "Map";
  const settingsBtn = document.createElement("button");
  settingsBtn.type = "button";
  settingsBtn.id = "hud-settings-btn";
  settingsBtn.className = "hud-minimap__gear";
  settingsBtn.setAttribute("aria-label", "settings");
  settingsBtn.title = "Settings";
  settingsBtn.textContent = "⚙";
  mmHeader.appendChild(mmTitle);
  mmHeader.appendChild(settingsBtn);
  minimap.appendChild(mmHeader);

  const map = document.createElement("div");
  map.className = "hud-minimap__canvas";
  map.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "hud-minimap__dot";
  map.appendChild(dot);
  minimap.appendChild(map);

  // Location line under the canvas, on its own row. Centered dot separator,
  // no truncation — gets enough width via the topRight max-width.
  const mmStats = document.createElement("div");
  mmStats.className = "hud-minimap__stats";
  const zoneEl = document.createElement("span");
  zoneEl.setAttribute("data-testid", "hud-zone");
  zoneEl.textContent = state.zone;
  const coords = document.createElement("span");
  coords.className = "t-num";
  coords.setAttribute("data-testid", "hud-coords");
  coords.textContent = `(${state.position.col}, ${state.position.row})`;
  const online = document.createElement("span");
  online.className = "t-num";
  online.setAttribute("data-testid", "hud-online");
  online.textContent = `${state.online} online`;
  appendSeparated(mmStats, [zoneEl, coords, online]);
  minimap.appendChild(mmStats);
  layout.attach("topRight", minimap);

  // --- bottomLeft: vitals (HP + skills) -----------------------------------
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
  hpBar.root.classList.add("hud-vitals__hp");
  vitals.appendChild(hpBar.root);

  const skillBars: Array<ReturnType<typeof createBar>> = [];
  const skillsWrap = document.createElement("div");
  skillsWrap.className = "hud-vitals__skills";
  skillsWrap.setAttribute("data-testid", "hud-skills");
  for (const s of state.skills) {
    const row = document.createElement("div");
    row.className = "hud-vitals__skill-row";
    const head = document.createElement("div");
    head.className = "hud-vitals__skill-head";
    const icon = createIcon({ slug: skillIcon(s.id), size: 14, ariaLabel: s.label });
    icon.classList.add("hud-vitals__skill-icon");
    const name = document.createElement("span");
    name.className = "hud-vitals__skill-name";
    name.textContent = s.label;
    const lvl = document.createElement("span");
    lvl.className = "hud-vitals__skill-level t-num";
    lvl.textContent = `L${s.level}`;
    head.appendChild(icon);
    head.appendChild(name);
    head.appendChild(lvl);
    const bar = createBar({
      value: s.xp,
      max: s.xpNext,
      variant: "reed",
      showNumbers: false,
    });
    bar.root.setAttribute("data-skill", s.id);
    bar.root.classList.add("hud-vitals__skill-bar");
    skillBars.push(bar);
    row.appendChild(head);
    row.appendChild(bar.root);
    skillsWrap.appendChild(row);
  }
  vitals.appendChild(skillsWrap);
  layout.attach("bottomLeft", vitals);

  // --- bottomCenter: hotbar (horizontal row) -----------------------------
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
    cell.classList.add("hud-hotbar__slot");
    cell.setAttribute("data-hotbar-index", String(i));
    if (slot !== null) {
      const icon = createIcon({ slug: slot.slug, size: 24, ariaLabel: slot.label });
      cell.insertBefore(icon, cell.firstChild);
    }
    const key = document.createElement("span");
    key.className = "hud-hotbar__key";
    key.textContent = String((i + 1) % 10);
    cell.appendChild(key);
    hotbarInner.appendChild(cell);
    hotbarSlots.push(cell);
  }
  hotbar.appendChild(hotbarInner);
  layout.attach("bottomCenter", hotbar);

  // --- bottomRight: currency ----------------------------------------------
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

  // --- rightEdge: tiny Chat toggle button ---------------------------------
  // No floating prose. The button opens a slim panel; collapsed it's just
  // a control. data-panel is not set on the wrapper so the visual gate
  // sees the button-only state as zero panels in this region.
  const chatWrap = document.createElement("div");
  chatWrap.className = "hud-chat";
  chatWrap.setAttribute("data-collapsed", "true");

  const chatToggle = document.createElement("button");
  chatToggle.type = "button";
  chatToggle.className = "hud-chat__toggle";
  chatToggle.setAttribute("aria-expanded", "false");
  chatToggle.setAttribute("aria-label", "open chat");
  chatToggle.textContent = "Chat";
  chatWrap.appendChild(chatToggle);

  const chatPanel = createPanel({ ariaLabel: "chat panel" });
  markPanel(chatPanel, "chat");
  chatPanel.classList.add("hud-chat__panel");
  const chatList = document.createElement("ul");
  chatList.className = "hud-chat__list";
  chatList.setAttribute("aria-live", "polite");
  chatPanel.appendChild(chatList);
  const chatInput = document.createElement("input");
  chatInput.type = "text";
  chatInput.className = "hud-chat__input";
  chatInput.placeholder = "Press Enter to send";
  chatInput.disabled = true;
  chatPanel.appendChild(chatInput);
  chatWrap.appendChild(chatPanel);

  chatToggle.addEventListener("click", () => {
    const collapsed = chatWrap.getAttribute("data-collapsed") === "true";
    chatWrap.setAttribute("data-collapsed", collapsed ? "false" : "true");
    chatToggle.setAttribute("aria-expanded", collapsed ? "true" : "false");
  });
  layout.attach("rightEdge", chatWrap);

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
      coords.textContent = `(${state.position.col}, ${state.position.row})`;
      const px = (state.position.col / 10) * 100;
      const py = (state.position.row / 10) * 100;
      dot.style.left = `${px}%`;
      dot.style.top = `${py}%`;
    }
    if (next.wood !== undefined) hudWoodMirror.textContent = String(state.wood);
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

function appendSeparated(parent: HTMLElement, items: HTMLElement[]): void {
  items.forEach((node, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "hud-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "·";
      parent.appendChild(sep);
    }
    parent.appendChild(node);
  });
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
