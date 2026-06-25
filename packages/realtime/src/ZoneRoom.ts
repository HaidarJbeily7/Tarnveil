import { Room, type Client } from "colyseus";
import {
  findPath,
  gridFromMatrix,
  inRange,
  tileDistance,
  type Grid,
  type SkillId,
  type TileCoord,
} from "@tarnveil/shared";
import { CharacterStore } from "./CharacterStore.js";
import { getDb } from "./db.js";
import { findNode, type ResourceKind } from "./resources.js";
import { ZONE_MOBS, PLAYER_BASE_DAMAGE, findMobDef } from "./mobs.js";
import { MobState, PlayerState, ZoneState } from "./state.js";

const ZONE_SIZE = 10;
const GATHER_RANGE = 1;
const ATTACK_RANGE = 1;
const XP_PER_GATHER = 25;
const XP_PER_KILL = 50;
const PLAYER_SPAWN: TileCoord = { col: 1, row: 1 };
const SIM_TICK_MS = 250;

const SKILL_BY_RESOURCE: Record<ResourceKind, SkillId> = {
  tree: "woodcutting",
  rock: "mining",
  fish: "fishing",
};

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
  return typeof (value as Record<string, unknown>)["nodeId"] === "string";
}

interface AttackPayload {
  mobId: string;
}

function isAttack(value: unknown): value is AttackPayload {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>)["mobId"] === "string";
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

export type AttackResult =
  | "hit"
  | "kill"
  | "no-mob"
  | "no-player"
  | "out-of-range";

export class ZoneRoom extends Room<{ state: ZoneState }> {
  private grid: Grid = buildZoneGrid();
  private store: CharacterStore | null = null;
  private clientToChar = new Map<string, string>();
  private inventories = new Map<string, Map<string, number>>();
  private nodeDepletedUntil = new Map<string, number>();
  private mobRespawnAt = new Map<string, number>();
  public lastGatherResult: GatherResult | null = null;
  public lastAttackResult: AttackResult | null = null;

  override onCreate(): void {
    this.setState(new ZoneState());
    this.autoDispose = false;
    this.store = new CharacterStore(getDb());

    for (const def of ZONE_MOBS) this.spawnMob(def.id);

    this.onMessage("move-to", (client, payload) => this.handleMoveTo(client, payload));
    this.onMessage("debug-give-item", (client, payload) =>
      this.handleDebugGive(client, payload),
    );
    this.onMessage("gather", (client, payload) => {
      void this.handleGather(client, payload);
    });
    this.onMessage("attack", (client, payload) => {
      void this.handleAttack(client, payload);
    });

    this.setSimulationInterval(() => this.tick(), SIM_TICK_MS);
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
    player.hp = character.hp;
    player.hpMax = character.hpMax;
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
      this.nodeDepletedUntil.set(node.id, depletedUntil);
      console.error("[zone] gather persist failed", err);
      this.lastGatherResult = "no-player";
      return "no-player";
    }
  }

  private async handleAttack(client: Client, payload: unknown): Promise<AttackResult> {
    if (!isAttack(payload)) {
      this.lastAttackResult = "no-mob";
      return "no-mob";
    }
    const def = findMobDef(payload.mobId);
    if (def === undefined) {
      this.lastAttackResult = "no-mob";
      return "no-mob";
    }
    const mob = this.state.mobs.get(def.id);
    if (mob === undefined) {
      this.lastAttackResult = "no-mob";
      return "no-mob";
    }
    const player = this.state.players.get(client.sessionId);
    const charId = this.clientToChar.get(client.sessionId);
    if (player === undefined || charId === undefined || this.store === null) {
      this.lastAttackResult = "no-player";
      return "no-player";
    }
    if (
      !inRange(
        { col: player.col, row: player.row },
        { col: mob.col, row: mob.row },
        ATTACK_RANGE,
      )
    ) {
      this.lastAttackResult = "out-of-range";
      return "out-of-range";
    }
    // Server-side combat math (R1): client's "attack" is intent only; damage
    // is the server's PLAYER_BASE_DAMAGE, never a client-supplied number.
    mob.hp = Math.max(0, mob.hp - PLAYER_BASE_DAMAGE);
    if (mob.hp > 0) {
      this.lastAttackResult = "hit";
      return "hit";
    }
    await this.killMob(def, charId, client.sessionId);
    this.lastAttackResult = "kill";
    return "kill";
  }

  private async killMob(def: { id: string; drop: { kind: string; qty: number } }, charId: string, sessionId: string): Promise<void> {
    if (this.store === null) return;
    const mobDef = findMobDef(def.id);
    if (mobDef === undefined) return;
    try {
      const after = await this.store.addItem(
        charId,
        def.drop.kind,
        def.drop.qty,
        `kill:${def.id}`,
      );
      const inv = this.inventories.get(sessionId);
      if (inv !== undefined) inv.set(def.drop.kind, after);
      await this.store.addXp(charId, "combat", XP_PER_KILL, `kill:${def.id}`);
    } catch (err) {
      console.error("[zone] kill persist failed", err);
    }
    this.state.mobs.delete(def.id);
    this.mobRespawnAt.set(def.id, Date.now() + mobDef.respawnMs);
  }

  private spawnMob(id: string): void {
    const def = findMobDef(id);
    if (def === undefined) return;
    const mob = new MobState();
    mob.id = def.id;
    mob.kind = def.kind;
    mob.col = def.spawn.col;
    mob.row = def.spawn.row;
    mob.hp = def.hpMax;
    mob.hpMax = def.hpMax;
    this.state.mobs.set(def.id, mob);
  }

  // Simulation tick: respawn dead mobs and run a minimal aggro/attack pass.
  private tick(): void {
    const now = Date.now();

    for (const [id, at] of this.mobRespawnAt) {
      if (now >= at) {
        this.spawnMob(id);
        this.mobRespawnAt.delete(id);
      }
    }

    for (const mob of this.state.mobs.values()) {
      const def = findMobDef(mob.id);
      if (def === undefined) continue;
      const target = this.nearestPlayerInRange(mob.col, mob.row, def.aggroRange);
      if (target === null) continue;
      if (
        inRange(
          { col: mob.col, row: mob.row },
          { col: target.col, row: target.row },
          ATTACK_RANGE,
        )
      ) {
        target.hp = Math.max(0, target.hp - def.damage);
        if (target.hp <= 0) this.respawnPlayer(target);
      } else {
        const path = findPath(
          this.grid,
          { col: mob.col, row: mob.row },
          { col: target.col, row: target.row },
        );
        const next = path[1];
        if (next) {
          mob.col = next.col;
          mob.row = next.row;
        }
      }
    }
  }

  private nearestPlayerInRange(col: number, row: number, range: number): PlayerState | null {
    let best: PlayerState | null = null;
    let bestDist = Infinity;
    for (const player of this.state.players.values()) {
      const d = tileDistance({ col, row }, { col: player.col, row: player.row });
      if (d <= range && d < bestDist) {
        best = player;
        bestDist = d;
      }
    }
    return best;
  }

  private respawnPlayer(player: PlayerState): void {
    player.col = PLAYER_SPAWN.col;
    player.row = PLAYER_SPAWN.row;
    player.hp = player.hpMax;
  }
}
