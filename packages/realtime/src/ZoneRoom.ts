import { Room, type Client } from "colyseus";
import { findPath, gridFromMatrix, type Grid } from "@tarnveil/shared";
import { CharacterStore } from "./CharacterStore.js";
import { getDb } from "./db.js";
import { PlayerState, ZoneState } from "./state.js";

const ZONE_SIZE = 10;

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

interface JoinOptions {
  characterName?: string;
}

export class ZoneRoom extends Room<{ state: ZoneState }> {
  private grid: Grid = buildZoneGrid();
  private store: CharacterStore | null = null;
  private clientToChar = new Map<string, string>();

  override onCreate(): void {
    this.setState(new ZoneState());
    this.autoDispose = false;
    this.store = new CharacterStore(getDb());

    this.onMessage("move-to", (client, payload) => this.handleMoveTo(client, payload));
    this.onMessage("debug-give-item", (client, payload) => this.handleDebugGive(client, payload));
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
    // Fire-and-forget: persistence error here surfaces in test failure but
    // shouldn't crash the room. R5: the store writes the ledger row.
    void this.store.addItem(charId, payload.kind, payload.qty, "debug-give-item").catch((err) => {
      console.error("[zone] debug-give failed", err);
    });
  }
}
