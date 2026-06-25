import { Room, type Client } from "colyseus";
import {
  findPath,
  inRange,
  tileDistance,
  type Grid,
  type SkillId,
  type TileCoord,
} from "@tarnveil/shared";
import { CharacterStore } from "./CharacterStore.js";
import { getDb } from "./db.js";
import { type ResourceKind, type ResourceNode } from "./resources.js";
import { PLAYER_BASE_DAMAGE, type MobDef } from "./mobs.js";
import { MobState, PlayerState, ZoneState } from "./state.js";
import { getZoneConfig, type ZoneConfig } from "./zones.js";

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

interface BankPayload {
  kind: string;
  qty: number;
  page: number;
}

function isBankPayload(value: unknown): value is BankPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p["kind"] === "string" &&
    Number.isInteger(p["qty"]) &&
    Number.isInteger(p["page"])
  );
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
  private zone!: ZoneConfig;
  private grid!: Grid;
  private store: CharacterStore | null = null;
  private clientToChar = new Map<string, string>();
  private inventories = new Map<string, Map<string, number>>();
  private nodeDepletedUntil = new Map<string, number>();
  private mobRespawnAt = new Map<string, number>();
  private inHandoff = new Set<string>();
  public lastGatherResult: GatherResult | null = null;
  public lastAttackResult: AttackResult | null = null;

  override onCreate(): void {
    // roomName is the zone id (server.ts registers one room per ZONES key).
    this.zone = getZoneConfig(this.roomName);
    this.grid = this.zone.buildGrid();
    this.setState(new ZoneState());
    this.autoDispose = false;
    this.store = new CharacterStore(getDb());

    for (const def of this.zone.mobs) this.spawnMob(def);

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
    this.onMessage("bank-deposit", (client, payload) => {
      void this.handleBank(client, payload, "deposit");
    });
    this.onMessage("bank-withdraw", (client, payload) => {
      void this.handleBank(client, payload, "withdraw");
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
    // If the character's persisted zone matches this room, restore exact
    // coords; otherwise drop them at this zone's spawn (zone handoff in 3.2).
    if (character.zone === this.zone.id) {
      player.col = character.col;
      player.row = character.row;
    } else {
      player.col = this.zone.spawn.col;
      player.row = this.zone.spawn.row;
    }
    player.hp = character.hp;
    player.hpMax = character.hpMax;
    this.state.players.set(client.sessionId, player);
  }

  override async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const charId = this.clientToChar.get(client.sessionId);
    // If we've already persisted the target zone/coords during a portal handoff,
    // skip the standard save so we don't overwrite it with the portal-tile pos.
    if (
      player !== undefined &&
      charId !== undefined &&
      this.store !== null &&
      !this.inHandoff.has(client.sessionId)
    ) {
      await this.store.savePosition(charId, player.col, player.row, this.zone.id);
    }
    this.inHandoff.delete(client.sessionId);
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

    // Portal step: if the new tile is a portal, persist target coords and
    // ask the client to re-join the target zone. Inventory/skills/gold are
    // already DB-backed, so the new room reads them on join (3.2 verify).
    const portal = this.zone.portals.find(
      (p) => p.at.col === player.col && p.at.row === player.row,
    );
    if (portal !== undefined) {
      void this.triggerPortal(client, portal);
    }
  }

  private async triggerPortal(
    client: Client,
    portal: { targetZone: string; spawnAt: TileCoord },
  ): Promise<void> {
    const charId = this.clientToChar.get(client.sessionId);
    if (charId === undefined || this.store === null) return;
    this.inHandoff.add(client.sessionId);
    try {
      await this.store.savePosition(
        charId,
        portal.spawnAt.col,
        portal.spawnAt.row,
        portal.targetZone,
      );
    } catch (err) {
      this.inHandoff.delete(client.sessionId);
      console.error("[zone] portal save failed", err);
      return;
    }
    client.send("portal", {
      targetZone: portal.targetZone,
      spawnAt: { col: portal.spawnAt.col, row: portal.spawnAt.row },
    });
    // Disconnect after a short window so the client has time to read the
    // message and join the target room.
    setTimeout(() => {
      try {
        client.leave();
      } catch {
        // best-effort
      }
    }, 100);
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
    const node: ResourceNode | undefined = this.zone.resources.find(
      (n) => n.id === payload.nodeId,
    );
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
    const def: MobDef | undefined = this.zone.mobs.find((m) => m.id === payload.mobId);
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

  private async handleBank(
    client: Client,
    payload: unknown,
    op: "deposit" | "withdraw",
  ): Promise<void> {
    if (!isBankPayload(payload)) return;
    const charId = this.clientToChar.get(client.sessionId);
    if (charId === undefined || this.store === null) return;
    try {
      const result =
        op === "deposit"
          ? await this.store.depositToBank(charId, payload.kind, payload.qty, payload.page, "client")
          : await this.store.withdrawFromBank(charId, payload.kind, payload.qty, payload.page, "client");
      const inv = this.inventories.get(client.sessionId);
      if (inv !== undefined) {
        if (result.inventoryQty <= 0) inv.delete(payload.kind);
        else inv.set(payload.kind, result.inventoryQty);
      }
    } catch (err) {
      console.error(`[zone] bank-${op} failed`, err);
    }
  }

  private async killMob(def: MobDef, charId: string, sessionId: string): Promise<void> {
    if (this.store === null) return;
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
    this.mobRespawnAt.set(def.id, Date.now() + def.respawnMs);
  }

  private spawnMob(def: MobDef): void {
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
        const def = this.zone.mobs.find((m) => m.id === id);
        if (def !== undefined) this.spawnMob(def);
        this.mobRespawnAt.delete(id);
      }
    }

    // Safe-zone heal: regen 1 HP per tick for players inside the bounds.
    const safe = this.zone.safeZone;
    if (safe !== null) {
      for (const player of this.state.players.values()) {
        if (
          player.col >= safe.topLeft.col &&
          player.col <= safe.bottomRight.col &&
          player.row >= safe.topLeft.row &&
          player.row <= safe.bottomRight.row &&
          player.hp < player.hpMax
        ) {
          player.hp = Math.min(player.hpMax, player.hp + 1);
        }
      }
    }

    for (const mob of this.state.mobs.values()) {
      const def = this.zone.mobs.find((m) => m.id === mob.id);
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
