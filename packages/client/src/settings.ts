/**
 * HUD settings panel wiring. Listens for clicks on the gear button + form
 * controls, persists choices to localStorage, and dispatches a custom event
 * the scenes pick up via `document.addEventListener('tarn:setting', ...)`.
 *
 * The actual rendering reaction (camera zoom, name-tag visibility, motion
 * reduction, position reset) lives in WorldScene — this module just owns
 * the DOM glue.
 */

export interface TarnSettings {
  zoom: number;
  showNameTags: boolean;
  reduceMotion: boolean;
}

const STORAGE_KEY = "tarn:settings:v1";

export const DEFAULT_SETTINGS: TarnSettings = {
  zoom: 1,
  showNameTags: true,
  reduceMotion: false,
};

function load(): TarnSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<TarnSettings>;
    return {
      zoom: typeof parsed.zoom === "number" ? clamp(parsed.zoom, 0.5, 2) : DEFAULT_SETTINGS.zoom,
      showNameTags:
        typeof parsed.showNameTags === "boolean" ? parsed.showNameTags : DEFAULT_SETTINGS.showNameTags,
      reduceMotion:
        typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(s: TarnSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

type SettingKey = keyof TarnSettings;

function emit(key: SettingKey, value: TarnSettings[SettingKey]): void {
  document.dispatchEvent(
    new CustomEvent("tarn:setting", { detail: { key, value } }),
  );
}

export function emitAction(action: "reset-position"): void {
  document.dispatchEvent(new CustomEvent("tarn:action", { detail: { action } }));
}

export function getCurrentSettings(): TarnSettings {
  return load();
}

/**
 * Open the settings overlay. Exposed so the in-world HUD gear (mounted
 * asynchronously after HUD render) can trigger it without searching for
 * the panel itself.
 */
export function openSettings(): void {
  document.getElementById("hud-settings")?.classList.add("open");
  document.getElementById("settings-overlay")?.classList.add("open");
}

/**
 * Wire the panel close button, overlay, form controls, and any settings
 * trigger present in the DOM at call time (#hud-settings-btn or the
 * legacy #hud-gear). Idempotent — safe to call on boot AND again after
 * the HUD mounts the in-panel gear.
 */
let wired = false;
export function wireSettingsPanel(): void {
  // Always re-bind triggers (cheap) so the HUD-mounted gear gets hooked
  // up even if wireSettingsPanel ran before the HUD was inserted.
  const triggers = [
    document.getElementById("hud-settings-btn"),
    document.getElementById("hud-gear"),
  ].filter((el): el is HTMLElement => el !== null);
  for (const t of triggers) {
    if (t.getAttribute("data-settings-wired") === "1") continue;
    t.setAttribute("data-settings-wired", "1");
    t.addEventListener("click", openSettings);
  }

  if (wired) return;
  wired = true;

  const panel = document.getElementById("hud-settings");
  const close = document.getElementById("settings-close");
  const overlay = document.getElementById("settings-overlay");
  if (panel === null || close === null || overlay === null) return;

  function dismiss(): void {
    panel!.classList.remove("open");
    overlay!.classList.remove("open");
  }
  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", dismiss);

  const initial = load();

  const zoom = document.getElementById("setting-zoom") as HTMLInputElement | null;
  const zoomValue = document.getElementById("setting-zoom-value");
  if (zoom !== null) {
    zoom.value = String(initial.zoom);
    if (zoomValue !== null) zoomValue.textContent = initial.zoom.toFixed(2);
    zoom.addEventListener("input", () => {
      const v = clamp(parseFloat(zoom.value), 0.5, 2);
      if (zoomValue !== null) zoomValue.textContent = v.toFixed(2);
      const next = { ...load(), zoom: v };
      save(next);
      emit("zoom", v);
    });
  }

  const nameTags = document.getElementById("setting-nametags") as HTMLInputElement | null;
  if (nameTags !== null) {
    nameTags.checked = initial.showNameTags;
    nameTags.addEventListener("change", () => {
      const v = nameTags.checked;
      const next = { ...load(), showNameTags: v };
      save(next);
      emit("showNameTags", v);
    });
  }

  const reduceMotion = document.getElementById("setting-motion") as HTMLInputElement | null;
  if (reduceMotion !== null) {
    reduceMotion.checked = initial.reduceMotion;
    reduceMotion.addEventListener("change", () => {
      const v = reduceMotion.checked;
      const next = { ...load(), reduceMotion: v };
      save(next);
      emit("reduceMotion", v);
    });
  }

  const resetBtn = document.getElementById("setting-reset");
  if (resetBtn !== null) {
    resetBtn.addEventListener("click", () => {
      emitAction("reset-position");
    });
  }

  // Esc closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismiss();
  });
}
