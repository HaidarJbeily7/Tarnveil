import { Schema, MapSchema, type } from "@colyseus/schema";

const PLAYER_HP_MAX_DEFAULT = 10;

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("number") col = 0;
  @type("number") row = 0;
  @type("number") hp = PLAYER_HP_MAX_DEFAULT;
  @type("number") hpMax = PLAYER_HP_MAX_DEFAULT;
}

export class MobState extends Schema {
  @type("string") id = "";
  @type("string") kind = "";
  @type("number") col = 0;
  @type("number") row = 0;
  @type("number") hp = 0;
  @type("number") hpMax = 0;
}

export class ZoneState extends Schema {
  @type("number") shard = 0;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();
}
