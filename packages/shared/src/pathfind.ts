import type { TileCoord } from "./entities.js";

export interface Grid {
  width: number;
  height: number;
  /** Return true if (col,row) is a walkable tile inside the map. */
  isWalkable(col: number, row: number): boolean;
}

/** Build a Grid from a 2D walkable matrix `walkable[row][col]`. */
export function gridFromMatrix(walkable: ReadonlyArray<ReadonlyArray<boolean>>): Grid {
  const height = walkable.length;
  const width = height === 0 ? 0 : walkable[0]!.length;
  return {
    width,
    height,
    isWalkable(col, row) {
      if (col < 0 || row < 0 || col >= width || row >= height) return false;
      return walkable[row]?.[col] === true;
    },
  };
}

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: Node | null;
}

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function keyOf(col: number, row: number): number {
  return row * 100000 + col;
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * A* on a 4-connected grid. Returns the path from `start` to `goal` inclusive,
 * or an empty array if `goal` is unreachable / either endpoint is unwalkable.
 */
export function findPath(grid: Grid, start: TileCoord, goal: TileCoord): TileCoord[] {
  if (!grid.isWalkable(start.col, start.row)) return [];
  if (!grid.isWalkable(goal.col, goal.row)) return [];
  if (start.col === goal.col && start.row === goal.row) return [{ ...start }];

  const open: Node[] = [];
  const visited = new Map<number, Node>();

  const startNode: Node = { col: start.col, row: start.row, g: 0, f: manhattan(start, goal), parent: null };
  open.push(startNode);
  visited.set(keyOf(startNode.col, startNode.row), startNode);

  while (open.length > 0) {
    // Cheap O(n) pop of the lowest-f node. For Phase 0 grids this is fine.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    }
    const current = open[bestIdx]!;
    open.splice(bestIdx, 1);

    if (current.col === goal.col && current.row === goal.row) {
      const path: TileCoord[] = [];
      let n: Node | null = current;
      while (n !== null) {
        path.push({ col: n.col, row: n.row });
        n = n.parent;
      }
      return path.reverse();
    }

    for (const [dc, dr] of NEIGHBOR_OFFSETS) {
      const nc = current.col + dc;
      const nr = current.row + dr;
      if (!grid.isWalkable(nc, nr)) continue;
      const tentativeG = current.g + 1;
      const k = keyOf(nc, nr);
      const seen = visited.get(k);
      if (seen !== undefined && tentativeG >= seen.g) continue;
      const node: Node = {
        col: nc,
        row: nr,
        g: tentativeG,
        f: tentativeG + manhattan({ col: nc, row: nr }, goal),
        parent: current,
      };
      visited.set(k, node);
      open.push(node);
    }
  }

  return [];
}
