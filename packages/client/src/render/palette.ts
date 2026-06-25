// Single source of colour for the client's clean low-poly / vector look.
// Every render module pulls from here so a re-skin is a one-file change.

export const PALETTE = {
  // World
  grassA: 0x3a5a3a,
  grassB: 0x456a45,
  grassEdge: 0x6d8d6d,
  hover: 0xf7e9b7,
  dirt: 0x8a6a3c,
  sky: 0x1f2429,

  // UI
  ui: 0xe8e2cf,
  shadow: 0x000000,

  // Entities
  self: 0xffd166,
  remote: 0x66ccff,
  wolf: 0x8a8278,
  wolfDark: 0x4a463f,

  // Tree
  trunk: 0x6b4226,
  trunkDark: 0x2a1c10,
  canopyA: 0x3b6b3b,
  canopyB: 0x2d5530,
  canopyC: 0x4a8252,

  // HP
  hp: 0xd64545,
  hpBg: 0x2a1010,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/**
 * Shift a hex colour's lightness by `delta` (positive lightens, negative
 * darkens). Crude RGB-space tweak — good enough for low-poly highlight rims
 * and faces without pulling a colour-space lib.
 */
export function shade(color: number, delta: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const k = delta;
  const adjust = (c: number): number => {
    if (k >= 0) return Math.min(255, Math.round(c + (255 - c) * k));
    return Math.max(0, Math.round(c * (1 + k)));
  };
  return (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
}
