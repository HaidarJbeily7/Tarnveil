// packages/shared/game.config.ts
export const GAME = {
  /** Display name — change this one value to rebrand the whole game. */
  name: process.env.GAME_NAME ?? "Tarnveil",
  /** Lowercase slug derived from name; used for ids, room namespaces, asset paths. */
  get slug() { return this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); },
  /** On-chain token ticker (Phase 6). */
  tokenSymbol: process.env.GAME_TOKEN_SYMBOL ?? "TARN",
  /** In-game soft currency label. */
  goldLabel: process.env.GAME_GOLD_LABEL ?? "Gold",
  /** Marketing tagline (optional, for splash/landing). */
  tagline: process.env.GAME_TAGLINE ?? "An isometric world to gather, fight, and trade.",
} as const;
