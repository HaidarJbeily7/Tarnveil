/**
 * Lightweight icon component — loads the curated SVG set processed by
 * scripts/process-assets.ts. The SVG is fetched on first use and cached;
 * fill="currentColor" means CSS controls the tint.
 */

export type IconSlug =
  | "wood-axe"
  | "pickaxe"
  | "fishing-rod"
  | "cooking-pot"
  | "wood-pile"
  | "rock"
  | "shield"
  | "heart-plus"
  | "coins"
  | "skills";

export interface IconOptions {
  slug: IconSlug;
  size?: number;
  ariaLabel?: string;
}

const cache = new Map<IconSlug, Promise<string>>();

function fetchSvg(slug: IconSlug): Promise<string> {
  const existing = cache.get(slug);
  if (existing !== undefined) return existing;
  const p = fetch(`/assets/icons/${slug}.svg`)
    .then((res) => (res.ok ? res.text() : ""))
    .catch(() => "");
  cache.set(slug, p);
  return p;
}

export function createIcon(opts: IconOptions): HTMLElement {
  const el = document.createElement("span");
  el.className = "icon";
  el.setAttribute("data-icon", opts.slug);
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  const size = opts.size ?? 18;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.color = "currentColor";
  el.style.flexShrink = "0";
  if (opts.ariaLabel !== undefined) {
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", opts.ariaLabel);
  } else {
    el.setAttribute("aria-hidden", "true");
  }
  void fetchSvg(opts.slug).then((svg) => {
    if (svg === "") return;
    el.innerHTML = svg.replace(
      "<svg ",
      `<svg width="${size}" height="${size}" `,
    );
  });
  return el;
}
