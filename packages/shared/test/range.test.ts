import { describe, it, expect } from "vitest";
import { inRange, tileDistance } from "../src/range.js";

describe("tile range", () => {
  it("Chebyshev distance treats diagonals as 1 step", () => {
    expect(tileDistance({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe(1);
    expect(tileDistance({ col: 0, row: 0 }, { col: 3, row: 1 })).toBe(3);
  });

  it("inRange admits the 8 neighbours at range 1", () => {
    const center = { col: 5, row: 5 };
    expect(inRange(center, { col: 4, row: 5 }, 1)).toBe(true);
    expect(inRange(center, { col: 6, row: 6 }, 1)).toBe(true);
    expect(inRange(center, { col: 7, row: 5 }, 1)).toBe(false);
  });
});
