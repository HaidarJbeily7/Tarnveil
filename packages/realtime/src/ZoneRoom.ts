import { Room, type Client } from "colyseus";
import { findPath, gridFromMatrix, type Grid } from "@tarnveil/shared";
import { PlayerState, ZoneState } from "./state.js";

const ZONE_SIZE = 10;
const SPAWN_COL = 1;
const SPAWN_ROW = 1;

// Server-side zone topology: same shape as the client's Phase 0 grid plus a
// short wall so we can verify movement rejection. Later phases replace this
// with per-zone map data loaded from the DB.
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

export class ZoneRoom extends Room<{ state: ZoneState }> {
  private grid: Grid = buildZoneGrid();

  override onCreate(): void {
    this.setState(new ZoneState());
    this.autoDispose = false;

    this.onMessage("move-to", (client, payload) => this.handleMoveTo(client, payload));
  }

  override onJoin(client: Client): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.col = SPAWN_COL;
    player.row = SPAWN_ROW;
    this.state.players.set(client.sessionId, player);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  // Exposed so tests and Phase 2 logic can reuse the same validator. R1: every
  // movement decision is made here, never trusted from the client.
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
}
