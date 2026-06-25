import { describe, it, expect } from "vitest";
import { tileToScreen, screenToTile, renderOrder } from "../src/iso.js";

describe("iso math", () => {
  it("round-trips screenToTile(tileToScreen(c,r)) === (c,r) over a range", () => {
    for (let col = -10; col <= 10; col++) {
      for (let row = -10; row <= 10; row++) {
        const screen = tileToScreen({ col, row });
        const back = screenToTile(screen);
        expect(back).toEqual({ col, row });
      }
    }
  });

  it("snaps near-tile clicks back to the same tile", () => {
    // A click 1px off the center of (3, 4) still resolves to (3, 4).
    const center = tileToScreen({ col: 3, row: 4 });
    expect(screenToTile({ x: center.x + 1, y: center.y - 1 })).toEqual({ col: 3, row: 4 });
  });

  it("renderOrder is monotonic along the iso diagonal", () => {
    expect(renderOrder({ col: 0, row: 0 })).toBe(0);
    expect(renderOrder({ col: 1, row: 0 })).toBe(1);
    expect(renderOrder({ col: 1, row: 1 })).toBe(2);
    expect(renderOrder({ col: 5, row: 2 })).toBe(7);
  });
});
