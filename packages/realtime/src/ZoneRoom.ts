import { Room, type Client } from "colyseus";
import {
  findPath,
  gridFromMatrix,
  inRange,
  type Grid,
  type SkillId,
} from "@tarnveil/shared";
import { CharacterStore } from "./CharacterStore.js";
import { getDb } from "./db.js";
import { findNode, type ResourceKind } from "./resources.js";
import { PlayerState, ZoneState } from "./state.js";

const XP_PER_GATHER = 25;
const SKILL_BY_RESOURCE: Record<ResourceKind, SkillId> = {
  tree: "woodcutting",
  rock: "mining",
  fish: "fishing",
};

const ZONE_SIZE = 10;
const GATHER_RANGE = 1;

function buildZoneGrid(): Grid {
  const matrix: boolean[][] = [];
  for (let r = 0; r < ZONE_SIZE; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < ZONE_SIZE; c++) row.push(true);
    matrix.push(row);
  }
  matrix[3]![3] = false;
  matrix[3]![4] = false;
  return gridFromMatrix(matrix);
}

interface MoveToPayload {
  col: number;
  row: number;
}

function isMoveTo(value: unknown): value is MoveToPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return Number.isInteger(p["col"]) && Number.isInteger(p["row"]);
}

interface DebugGivePayload {
  kind: string;
  qty: number;
}

function isDebugGive(value: unknown): value is DebugGivePayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p["kind"] === "string" && Number.isInteger(p["qty"]);
}

interface GatherPayload {
  nodeId: string;
}

function isGather(value: unknown): value is GatherPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p["nodeId"] === "string";
}

interface JoinOptions {
  characterName?: string;
}

export type GatherResult =
  | "ok"
  | "no-node"
  | "no-player"
  | "out-of-range"
  | "cooldown"
  | "missing-tool";

export class ZoneRoom extends Room<{ state: ZoneState }> {
  private grid: Grid = buildZoneGrid();
  private store: CharacterStore | null = null;
  private clientToChar = new Map<string, string>();
  private inventories = new Map<string, Map<string, number>>();
  private nodeDepletedUntil = new Map<string, number>();
  // Exposed for tests so they can deterministically observe gather results
  // without instrumenting the message return value.
  public lastGatherResult: GatherResult | null = null;

  override onCreate(): void {
    this.setState(new ZoneState());
    this.autoDispose = false;
    this.store = new CharacterStore(getDb());

    this.onMessage("move-to", (client, payload) => this.handleMoveTo(client, payload));
    this.onMessage("debug-give-item", (client, payload) =>
      this.handleDebugGive(client, payload),
    );
    this.onMessage("gather", (client, payload) => {
      void this.handleGather(client, payload);
    });
  }

  override async onAuth(_client: Client, options: JoinOptions): Promise<string> {
    const name = options.characterName;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("characterName required");
    }
    return name;
  }

  override async onJoin(client: Client, _options: JoinOptions, auth: string): Promise<void> {
    if (this.store === null) throw new Error("store not initialized");
    const character = await this.store.loadOrCreateByName(auth);
    this.clientToChar.set(client.sessionId, character.id);

    const inv = await this.store.getInventory(character.id);
    const invMap = new Map<string, number>();
    for (const item of inv) invMap.set(item.kind, item.qty);
    this.inventories.set(client.sessionId, invMap);

    const player = new PlayerState();
    player.id = client.sessionId;
    player.col = character.col;
    player.row = character.row;
    this.state.players.set(client.sessionId, player);
  }

  override async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const charId = this.clientToChar.get(client.sessionId);
    if (player !== undefined && charId !== undefined && this.store !== null) {
      await this.store.savePosition(charId, player.col, player.row, "mainland");
    }
    this.clientToChar.delete(client.sessionId);
    this.inventories.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private handleMoveTo(client: Client, payload: unknown): void {
    if (!isMoveTo(payload)) return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!this.grid.isWalkable(payload.col, payload.row)) return;
    if (payload.col === player.col && payload.row === player.row) return;
    const path = findPath(
      this.grid,
      { col: player.col, row: player.row },
      { col: payload.col, row: payload.row },
    );
    if (path.length < 2) return;
    player.col = payload.col;
    player.row = payload.row;
  }

  private handleDebugGive(client: Client, payload: unknown): void {
    if (!isDebugGive(payload)) return;
    const charId = this.clientToChar.get(client.sessionId);
    if (charId === undefined || this.store === null) return;
    void this.store
      .addItem(charId, payload.kind, payload.qty, "debug-give-item")
      .then((after) => {
        const inv = this.inventories.get(client.sessionId);
        if (inv !== undefined) inv.set(payload.kind, after);
      })
      .catch((err) => console.error("[zone] debug-give failed", err));
  }

  private async handleGather(client: Client, payload: unknown): Promise<GatherResult> {
    if (!isGather(payload)) {
      this.lastGatherResult = "no-node";
      return "no-node";
    }
    const node = findNode(payload.nodeId);
    if (node === undefined) {
      this.lastGatherResult = "no-node";
      return "no-node";
    }
    const player = this.state.players.get(client.sessionId);
    const charId = this.clientToChar.get(client.sessionId);
    if (player === undefined || charId === undefined || this.store === null) {
      this.lastGatherResult = "no-player";
      return "no-player";
    }
    if (!inRange({ col: player.col, row: player.row }, node.tile, GATHER_RANGE)) {
      this.lastGatherResult = "out-of-range";
      return "out-of-range";
    }
    const depletedUntil = this.nodeDepletedUntil.get(node.id) ?? 0;
    if (Date.now() < depletedUntil) {
      this.lastGatherResult = "cooldown";
      return "cooldown";
    }
    if (node.requiredTool !== null) {
      const inv = this.inventories.get(client.sessionId);
      const have = inv?.get(node.requiredTool) ?? 0;
      if (have <= 0) {
        this.lastGatherResult = "missing-tool";
        return "missing-tool";
      }
    }
    // Reserve the cooldown BEFORE the await so concurrent messages can't
    // both pass the cooldown check and award two resources.
    this.nodeDepletedUntil.set(node.id, Date.now() + node.respawnMs);
    try {
      const after = await this.store.addItem(
        charId,
        node.resource,
        1,
        `gather:${node.id}`,
      );
      const inv = this.inventories.get(client.sessionId);
      if (inv !== undefined) inv.set(node.resource, after);
      await this.store.addXp(
        charId,
        SKILL_BY_RESOURCE[node.kind],
        XP_PER_GATHER,
        `gather:${node.id}`,
      );
      this.lastGatherResult = "ok";
      return "ok";
    } catch (err) {
      // Roll back the cooldown reservation if persistence failed.
      this.nodeDepletedUntil.set(node.id, depletedUntil);
      console.error("[zone] gather persist failed", err);
      this.lastGatherResult = "no-player";
      return "no-player";
    }
  }
}
