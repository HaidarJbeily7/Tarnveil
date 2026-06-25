// Tarnveil design tokens — the single source of visual truth for every UI
// surface. Every screen file pulls colour / spacing / radius / z-index from
// here; raw literals outside `theme.*` are blocked by `test/no-raw-hex.test.ts`.
//
// Theme direction: "Lakeside dusk, enamel & lantern".

/** The six named colours from FRONTEND_SPEC. */
export const COLORS = {
  /** deep teal-slate; world scrim & deepest background */
  ink: "#0E1B22",
  /** panel base — frosted "lakeglass" */
  slate: "#16313B",
  /** primary text / hairlines; moonlit off-white */
  mist: "#DCE6E4",
  /** interactive / links / selection; mid teal */
  lake: "#2F8E8C",
  /** CTAs + the GOLD currency; warm amber (use sparingly) */
  lantern: "#E8A14B",
  /** danger, death, PvP, destructive actions */
  rust: "#C2562F",
  /** muted support — nature / skills */
  reed: "#9CB07A",
  /** muted support — corner ticks / dividers */
  brass: "#C8A668",
} as const;

export type ColorToken = keyof typeof COLORS;

/** 8 px spacing grid (the key tells you how many 8 px units, except 1 = 4 px). */
export const SPACING = {
  0: "0px",
  /** 4 px — sub-grid for hairlines + tiny gaps */
  1: "4px",
  /** 8 px — base unit */
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
  16: "64px",
} as const;

export type SpacingToken = keyof typeof SPACING;

/** Border radii. "Small and consistent" per the spec — md (6px) is the default. */
export const RADIUS = {
  sm: "4px",
  md: "6px",
  lg: "12px",
  pill: "9999px",
} as const;

export type RadiusToken = keyof typeof RADIUS;

/** Stacking order from background to foreground. */
export const Z = {
  world: 0,
  hud: 10,
  panels: 20,
  modals: 30,
  toasts: 40,
} as const;

export type ZToken = keyof typeof Z;

/** Hairline divider — `--mist` at 12% opacity, per spec. */
export const HAIRLINE = "rgba(220, 230, 228, 0.12)";

/** Map a colour token to a CSS variable reference (used by components). */
export function cssVar(token: ColorToken | "hairline"): string {
  if (token === "hairline") return "var(--hairline)";
  return `var(--${token})`;
}
