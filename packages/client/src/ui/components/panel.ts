export interface PanelOptions {
  tone?: "default" | "elevated";
  /** Optional accessible label for the panel as a region. */
  ariaLabel?: string;
}

/**
 * The signature "lakeglass" panel — frosted slate background, a faint top
 * mist glow, and four brass L-corner ticks instead of a full border.
 *
 * Caller supplies children:
 *   const p = createPanel();
 *   p.appendChild(headerNode);
 *   p.appendChild(bodyNode);
 */
export function createPanel(opts: PanelOptions = {}): HTMLElement {
  const el = document.createElement("section");
  el.className = "panel";
  if (opts.tone === "elevated") el.classList.add("panel--elevated");
  if (opts.ariaLabel !== undefined) el.setAttribute("aria-label", opts.ariaLabel);

  // Four corner ticks
  for (const c of ["tl", "tr", "bl", "br"]) {
    const corner = document.createElement("span");
    corner.className = `panel__corner panel__corner--${c}`;
    corner.setAttribute("aria-hidden", "true");
    el.appendChild(corner);
  }

  return el;
}
