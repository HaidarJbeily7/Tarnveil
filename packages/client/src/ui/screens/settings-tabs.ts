import { createPanel, createTabs } from "../components/index.js";
import "./settings-tabs.css";

const STORAGE_KEY = "tarn:settings-tabs:v1";

interface SettingsV2 {
  audio: { master: number; sfx: number; music: number };
  graphics: { quality: "low" | "medium" | "high"; mist: boolean };
  accessibility: { reducedMotion: boolean; palette: "default" | "cb"; textSize: number };
}

const DEFAULT: SettingsV2 = {
  audio: { master: 0.8, sfx: 0.9, music: 0.6 },
  graphics: { quality: "medium", mist: true },
  accessibility: { reducedMotion: false, palette: "default", textSize: 1 },
};

function load(): SettingsV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return JSON.parse(JSON.stringify(DEFAULT));
    return { ...DEFAULT, ...(JSON.parse(raw) as SettingsV2) };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT));
  }
}

function save(s: SettingsV2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

function apply(s: SettingsV2): void {
  document.documentElement.setAttribute(
    "data-palette",
    s.accessibility.palette,
  );
  document.documentElement.style.setProperty(
    "font-size",
    `${Math.round(s.accessibility.textSize * 100)}%`,
  );
}

export function mountSettingsTabs(target: HTMLElement = document.body): () => void {
  const state = load();
  apply(state);

  const root = document.createElement("div");
  root.className = "settings-tabs";
  root.setAttribute("data-testid", "settings-tabs-screen");

  const title = document.createElement("h1");
  title.className = "settings-tabs__title";
  title.textContent = "Settings";
  root.appendChild(title);

  const panel = createPanel({ ariaLabel: "settings" });
  panel.classList.add("settings-tabs__panel");

  const body = document.createElement("div");
  body.setAttribute("data-testid", "settings-tabs-body");
  let active = "audio";
  const tabs = createTabs({
    tabs: [
      { id: "audio", label: "Audio" },
      { id: "graphics", label: "Graphics" },
      { id: "controls", label: "Controls" },
      { id: "accessibility", label: "Accessibility" },
    ],
    onChange: (id) => {
      active = id;
      paint();
    },
  });
  panel.appendChild(tabs.root);
  panel.appendChild(body);
  function paint(): void {
    body.replaceChildren();
    if (active === "audio") paintAudio(body, state);
    else if (active === "graphics") paintGraphics(body, state);
    else if (active === "controls") paintControls(body);
    else paintA11y(body, state);
  }
  paint();

  root.appendChild(panel);
  target.appendChild(root);

  return () => root.remove();
}

function rangeRow(label: string, desc: string, value: number, onInput: (v: number) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-tabs__row";
  const head = document.createElement("div");
  head.className = "head";
  const lbl = document.createElement("span");
  lbl.textContent = label;
  const val = document.createElement("span");
  val.className = "settings-tabs__value";
  val.textContent = value.toFixed(2);
  head.appendChild(lbl);
  head.appendChild(val);
  row.appendChild(head);
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  input.value = String(value);
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    val.textContent = v.toFixed(2);
    onInput(v);
  });
  row.appendChild(input);
  const p = document.createElement("p");
  p.className = "desc";
  p.textContent = desc;
  row.appendChild(p);
  return row;
}

function paintAudio(host: HTMLElement, state: SettingsV2): void {
  host.appendChild(
    rangeRow("Master volume", "Affects all sounds.", state.audio.master, (v) => {
      state.audio.master = v;
      save(state);
    }),
  );
  host.appendChild(
    rangeRow("SFX", "Combat, gathering, UI clicks.", state.audio.sfx, (v) => {
      state.audio.sfx = v;
      save(state);
    }),
  );
  host.appendChild(
    rangeRow("Music", "Ambient lake themes.", state.audio.music, (v) => {
      state.audio.music = v;
      save(state);
    }),
  );
}

function paintGraphics(host: HTMLElement, state: SettingsV2): void {
  const row = document.createElement("div");
  row.className = "settings-tabs__row";
  const head = document.createElement("div");
  head.className = "head";
  const lbl = document.createElement("span");
  lbl.textContent = "Quality";
  head.appendChild(lbl);
  row.appendChild(head);
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "graphics quality");
  for (const q of ["low", "medium", "high"]) {
    const o = document.createElement("option");
    o.value = q;
    o.textContent = q;
    if (q === state.graphics.quality) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    state.graphics.quality = sel.value as SettingsV2["graphics"]["quality"];
    save(state);
  });
  row.appendChild(sel);
  host.appendChild(row);

  const mist = document.createElement("label");
  mist.className = "settings-tabs__row";
  const head2 = document.createElement("div");
  head2.className = "head";
  const span = document.createElement("span");
  span.textContent = "Drift mist";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = state.graphics.mist;
  cb.setAttribute("data-testid", "settings-mist");
  cb.addEventListener("change", () => {
    state.graphics.mist = cb.checked;
    save(state);
  });
  head2.appendChild(span);
  head2.appendChild(cb);
  mist.appendChild(head2);
  const p = document.createElement("p");
  p.className = "desc";
  p.textContent = "Ambient drifting mist on menus.";
  mist.appendChild(p);
  host.appendChild(mist);
}

function paintControls(host: HTMLElement): void {
  const note = document.createElement("p");
  note.className = "settings-tabs__row";
  note.textContent = "Default keybinds. Custom binding lands later.";
  host.appendChild(note);
  const grid = document.createElement("div");
  grid.className = "settings-tabs__keybinds";
  for (const [action, key] of [
    ["Move", "Click tile"],
    ["Interact", "Click target"],
    ["Inventory", "I"],
    ["Skills", "K"],
    ["Quests", "L"],
    ["Chat", "Enter"],
  ]) {
    const a = document.createElement("span");
    a.textContent = action ?? "";
    const k = document.createElement("span");
    k.className = "key";
    k.textContent = key ?? "";
    grid.appendChild(a);
    grid.appendChild(k);
  }
  host.appendChild(grid);
}

function paintA11y(host: HTMLElement, state: SettingsV2): void {
  // Reduced motion
  const motion = document.createElement("label");
  motion.className = "settings-tabs__row";
  const motionHead = document.createElement("div");
  motionHead.className = "head";
  const motionSpan = document.createElement("span");
  motionSpan.textContent = "Reduce motion";
  const motionCb = document.createElement("input");
  motionCb.type = "checkbox";
  motionCb.checked = state.accessibility.reducedMotion;
  motionCb.setAttribute("data-testid", "settings-reduce-motion");
  motionCb.addEventListener("change", () => {
    state.accessibility.reducedMotion = motionCb.checked;
    save(state);
  });
  motionHead.appendChild(motionSpan);
  motionHead.appendChild(motionCb);
  motion.appendChild(motionHead);
  const mp = document.createElement("p");
  mp.className = "desc";
  mp.textContent = "Disable idle and reveal animations everywhere.";
  motion.appendChild(mp);
  host.appendChild(motion);

  // Colour-blind palette
  const palette = document.createElement("div");
  palette.className = "settings-tabs__row";
  const ph = document.createElement("div");
  ph.className = "head";
  ph.appendChild(document.createTextNode("Colour-blind safe palette"));
  const pCb = document.createElement("input");
  pCb.type = "checkbox";
  pCb.checked = state.accessibility.palette === "cb";
  pCb.setAttribute("data-testid", "settings-palette");
  pCb.addEventListener("change", () => {
    state.accessibility.palette = pCb.checked ? "cb" : "default";
    save(state);
    apply(state);
  });
  ph.appendChild(pCb);
  palette.appendChild(ph);
  const pp = document.createElement("p");
  pp.className = "desc";
  pp.textContent = "Shifts hue families while keeping every pair AA contrast.";
  palette.appendChild(pp);
  host.appendChild(palette);

  // Text size
  host.appendChild(
    rangeRow(
      "UI text size",
      "Scales the base font size from 80 % to 140 %.",
      state.accessibility.textSize,
      (v) => {
        state.accessibility.textSize = v;
        save(state);
        apply(state);
      },
    ),
  );
}
