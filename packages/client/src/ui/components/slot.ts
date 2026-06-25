export interface SlotOptions {
  icon?: string;
  qty?: number;
  selected?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}

/** Inventory cell. Keyboard-focusable; numeric qty in tabular figures. */
export function createSlot(opts: SlotOptions = {}): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "slot";
  if (opts.ariaLabel !== undefined) el.setAttribute("aria-label", opts.ariaLabel);
  if (opts.selected === true) el.setAttribute("data-selected", "true");
  if (opts.icon !== undefined) {
    const span = document.createElement("span");
    span.className = "slot__icon";
    span.textContent = opts.icon;
    span.setAttribute("aria-hidden", "true");
    el.appendChild(span);
  }
  if (opts.qty !== undefined && opts.qty > 1) {
    const q = document.createElement("span");
    q.className = "slot__qty";
    q.textContent = String(opts.qty);
    el.appendChild(q);
  }
  if (opts.onClick !== undefined) el.addEventListener("click", opts.onClick);
  return el;
}
