import { SKILL_LEVEL_CAP } from "./constants.js";
import type { SkillId } from "./entities.js";

export const XP_PER_LEVEL = 100;
export const ALL_SKILLS: readonly SkillId[] = [
  "combat",
  "woodcutting",
  "mining",
  "fishing",
  "cooking",
] as const;

/** Map a non-negative xp total to a level in [1, SKILL_LEVEL_CAP]. */
export function xpToLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  const raw = 1 + Math.floor(xp / XP_PER_LEVEL);
  return Math.min(SKILL_LEVEL_CAP, raw);
}

/** Inverse: xp threshold required to first reach `level`. */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  const clamped = Math.min(SKILL_LEVEL_CAP, level);
  return (clamped - 1) * XP_PER_LEVEL;
}
