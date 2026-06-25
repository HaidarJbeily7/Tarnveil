import { GAME } from "@tarnveil/shared/game.config";
import "./loading.css";

const TIPS: ReadonlyArray<string> = [
  "Click a tile to walk. The server decides the path.",
  "Chop trees by clicking them — your axe matters.",
  "Bank items often. Death in PvP drops what you carry.",
  "Daily quests reset at midnight local time.",
  "Friends show their zone — meet up faster.",
  "Sell on the marketplace for gold; bridge gold for token.",
];

/**
 * C15 — Branded loading screen + zone-transition wipe.
 *
 * mountLoading() renders the full-screen loading view at /?ui=loading;
 * it ticks a faux progress bar over 1.6 s and cycles a tip line.
 * playZoneVeil() runs the veil-wipe transition; safe to call any time.
 */
export function mountLoading(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "loading";
  root.setAttribute("data-testid", "loading-screen");

  const mist = document.createElement("div");
  mist.className = "loading__mist";
  mist.setAttribute("aria-hidden", "true");
  root.appendChild(mist);

  const wordmark = document.createElement("h1");
  wordmark.className = "loading__wordmark";
  wordmark.setAttribute("data-testid", "loading-wordmark");
  wordmark.textContent = GAME.name;
  root.appendChild(wordmark);

  const tip = document.createElement("p");
  tip.className = "loading__tip";
  tip.setAttribute("data-testid", "loading-tip");
  tip.setAttribute("aria-live", "polite");
  tip.textContent = TIPS[0]!;
  root.appendChild(tip);

  const bar = document.createElement("div");
  bar.className = "loading__bar";
  const fill = document.createElement("div");
  fill.className = "loading__bar-fill";
  fill.setAttribute("data-testid", "loading-fill");
  bar.appendChild(fill);
  root.appendChild(bar);

  const pct = document.createElement("span");
  pct.className = "loading__pct";
  pct.setAttribute("data-testid", "loading-pct");
  pct.textContent = "0 %";
  root.appendChild(pct);

  target.appendChild(root);

  // Tick — staged percentages
  const steps = [10, 30, 55, 75, 90, 100];
  let i = 0;
  function tick(): void {
    const v = steps[i++] ?? 100;
    fill.style.width = `${v}%`;
    pct.textContent = `${v} %`;
    if (v < 100) setTimeout(tick, 260);
  }
  setTimeout(tick, 80);

  // Cycle tips every 3 s
  let tipIdx = 0;
  const tipTimer = setInterval(() => {
    tipIdx = (tipIdx + 1) % TIPS.length;
    tip.textContent = TIPS[tipIdx]!;
  }, 3000);

  return () => {
    clearInterval(tipTimer);
    root.remove();
  };
}

export function playZoneVeil(target: HTMLElement = document.body): void {
  const v = document.createElement("div");
  v.className = "veil-wipe";
  v.setAttribute("data-testid", "veil-wipe");
  v.setAttribute("aria-hidden", "true");
  target.appendChild(v);
  setTimeout(() => v.remove(), 700);
}
