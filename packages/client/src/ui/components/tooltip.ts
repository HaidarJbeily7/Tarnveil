let currentTip: HTMLElement | null = null;

function ensureTipNode(): HTMLElement {
  if (currentTip !== null) return currentTip;
  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  currentTip = tip;
  return tip;
}

/**
 * Attach a hover/focus tooltip to `target`. Reads on a delay; positions
 * itself just above the target. Keyboard-reachable: hover OR focus
 * triggers the same tooltip.
 */
export function attachTooltip(target: HTMLElement, content: string): void {
  target.setAttribute("aria-describedby", "tarn-tooltip");
  const show = (): void => {
    const tip = ensureTipNode();
    tip.id = "tarn-tooltip";
    tip.textContent = content;
    const rect = target.getBoundingClientRect();
    tip.style.left = `${rect.left + rect.width / 2}px`;
    tip.style.top = `${rect.top - 8}px`;
    tip.style.transform = "translate(-50%, -100%)";
    tip.setAttribute("data-show", "true");
  };
  const hide = (): void => {
    const tip = ensureTipNode();
    tip.removeAttribute("data-show");
  };
  target.addEventListener("mouseenter", show);
  target.addEventListener("mouseleave", hide);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
}
