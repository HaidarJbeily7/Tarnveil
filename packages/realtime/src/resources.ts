import type { TileCoord } from "@tarnveil/shared";

export type ResourceKind = "tree" | "rock" | "fish";

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  tile: TileCoord;
  /** Inventory kind awarded on a successful gather. */
  resource: string;
  /** Required tool in the gatherer's inventory; null = barehand-gatherable. */
  requiredTool: string | null;
  /** ms between depletion and the node being gatherable again. */
  respawnMs: number;
}

export const ZONE_RESOURCE_NODES: readonly ResourceNode[] = [
  { id: "tree-1", kind: "tree", tile: { col: 5, row: 5 }, resource: "wood", requiredTool: "woodaxe", respawnMs: 2000 },
  { id: "rock-1", kind: "rock", tile: { col: 6, row: 6 }, resource: "stone", requiredTool: "pickaxe", respawnMs: 3000 },
];

export function findNode(id: string): ResourceNode | undefined {
  return ZONE_RESOURCE_NODES.find((n) => n.id === id);
}
