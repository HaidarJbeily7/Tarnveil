import { describe, it, expect } from "vitest";
import { SKILL_LEVEL_CAP, xpThresholdForLevel, xpToLevel } from "../src/index.js";

describe("skill XP curve", () => {
  it("0 xp is level 1", () => {
    expect(xpToLevel(0)).toBe(1);
    expect(xpToLevel(-5)).toBe(1);
  });

  it("level boundaries match the curve", () => {
    expect(xpToLevel(99)).toBe(1);
    expect(xpToLevel(100)).toBe(2);
    expect(xpToLevel(199)).toBe(2);
    expect(xpToLevel(200)).toBe(3);
  });

  it("caps at SKILL_LEVEL_CAP regardless of xp", () => {
    expect(xpToLevel(1_000_000)).toBe(SKILL_LEVEL_CAP);
  });

  it("xpThresholdForLevel inverts xpToLevel at boundaries", () => {
    for (let level = 1; level <= SKILL_LEVEL_CAP; level++) {
      const xp = xpThresholdForLevel(level);
      expect(xpToLevel(xp)).toBe(level);
    }
  });

  it("xpThresholdForLevel clamps above the cap", () => {
    expect(xpThresholdForLevel(99)).toBe(xpThresholdForLevel(SKILL_LEVEL_CAP));
  });
});
