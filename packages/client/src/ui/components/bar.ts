export type BarVariant = "hp" | "xp" | "reed" | "lantern";

export interface BarOptions {
  value: number;
  max: number;
  variant?: BarVariant;
  label?: string;
  /** Show "value / max" on the right side of the head. */
  showNumbers?: boolean;
}

export interface BarControl {
  root: HTMLElement;
  setValue(value: number, max?: number): void;
}

export function createBar(opts: BarOptions): BarControl {
  const root = document.createElement("div");
  root.className = `bar bar--${opts.variant ?? "xp"}`;
  root.setAttribute("role", "progressbar");

  const showNumbers = opts.showNumbers !== false;
  let head: HTMLElement | null = null;
  let value: HTMLElement | null = null;
  if (opts.label !== undefined || showNumbers) {
    head = document.createElement("div");
    head.className = "bar__head";
    if (opts.label !== undefined) {
      const lbl = document.createElement("span");
      lbl.className = "bar__label";
      lbl.textContent = opts.label;
      head.appendChild(lbl);
    }
    if (showNumbers) {
      value = document.createElement("span");
      value.className = "bar__value t-num";
      head.appendChild(value);
    }
    root.appendChild(head);
  }

  const track = document.createElement("div");
  track.className = "bar__track";
  const fill = document.createElement("div");
  fill.className = "bar__fill";
  track.appendChild(fill);
  root.appendChild(track);

  const update = (v: number, m: number): void => {
    const safeMax = Math.max(1, m);
    const safeVal = Math.max(0, Math.min(safeMax, v));
    fill.style.width = `${(safeVal / safeMax) * 100}%`;
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", String(safeMax));
    root.setAttribute("aria-valuenow", String(safeVal));
    if (value !== null) value.textContent = `${safeVal} / ${safeMax}`;
  };
  update(opts.value, opts.max);

  return {
    root,
    setValue(v, m) {
      update(v, m ?? opts.max);
    },
  };
}
