import { describe, it, expect } from "vitest";
import { findPath, gridFromMatrix } from "../src/pathfind.js";

const _ = true;
const X = false;

describe("A* pathfinding", () => {
  it("finds the shortest path on an open grid", () => {
    const grid = gridFromMatrix([
      [_, _, _, _],
      [_, _, _, _],
      [_, _, _, _],
    ]);
    const path = findPath(grid, { col: 0, row: 0 }, { col: 3, row: 2 });
    expect(path[0]).toEqual({ col: 0, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: 3, row: 2 });
    // Manhattan distance + 1 for the start node.
    expect(path).toHaveLength(3 + 2 + 1);
  });

  it("routes around a blocked tile", () => {
    const grid = gridFromMatrix([
      [_, _, _, _, _],
      [_, _, X, _, _],
      [_, _, _, _, _],
    ]);
    const path = findPath(grid, { col: 0, row: 1 }, { col: 4, row: 1 });
    // Must not step on (2,1).
    expect(path.find((t) => t.col === 2 && t.row === 1)).toBeUndefined();
    expect(path[0]).toEqual({ col: 0, row: 1 });
    expect(path[path.length - 1]).toEqual({ col: 4, row: 1 });
    // Shortest detour adds two extra steps (around the wall).
    expect(path).toHaveLength(4 + 1 + 2);
  });

  it("returns empty for an unreachable goal", () => {
    const grid = gridFromMatrix([
      [_, X, _],
      [_, X, _],
      [_, X, _],
    ]);
    expect(findPath(grid, { col: 0, row: 0 }, { col: 2, row: 0 })).toEqual([]);
  });

  it("returns empty when start or goal is unwalkable", () => {
    const grid = gridFromMatrix([
      [_, _, _],
      [X, X, X],
      [_, _, _],
    ]);
    expect(findPath(grid, { col: 0, row: 1 }, { col: 2, row: 2 })).toEqual([]);
    expect(findPath(grid, { col: 0, row: 0 }, { col: 1, row: 1 })).toEqual([]);
  });

  it("returns [start] when start equals goal", () => {
    const grid = gridFromMatrix([[_, _], [_, _]]);
    expect(findPath(grid, { col: 1, row: 1 }, { col: 1, row: 1 })).toEqual([{ col: 1, row: 1 }]);
  });
});
