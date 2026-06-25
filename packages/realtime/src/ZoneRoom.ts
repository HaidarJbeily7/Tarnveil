import { Room, type Client } from "colyseus";
import { PlayerState, ZoneState } from "./state.js";

const SPAWN_COL = 1;
const SPAWN_ROW = 1;

export class ZoneRoom extends Room<{ state: ZoneState }> {
  override onCreate(): void {
    this.setState(new ZoneState());
    // Keep zone rooms alive across an empty client list so tests can assert
    // post-leave state and future zones don't churn between empty windows.
    this.autoDispose = false;
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
}
