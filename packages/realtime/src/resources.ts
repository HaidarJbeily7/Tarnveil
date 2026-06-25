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

// Concrete node lists live in zones.ts; this module only defines the shape.
