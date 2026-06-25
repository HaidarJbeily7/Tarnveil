export interface ButtonOptions {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "default" | "small";
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  /** Icon-only buttons should set this. */
  ariaLabel?: string;
  type?: "button" | "submit";
}

export function createButton(opts: ButtonOptions): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = "btn";
  el.classList.add(`btn--${opts.variant ?? "secondary"}`);
  if (opts.size === "small") el.classList.add("btn--small");
  el.type = opts.type ?? "button";
  el.textContent = opts.label;
  if (opts.disabled) el.disabled = true;
  if (opts.ariaLabel !== undefined) el.setAttribute("aria-label", opts.ariaLabel);
  if (opts.onClick !== undefined) el.addEventListener("click", opts.onClick);
  return el;
}
