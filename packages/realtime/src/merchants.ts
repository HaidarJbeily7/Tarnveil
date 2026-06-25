import type { TileCoord } from "@tarnveil/shared";

export interface Merchant {
  id: string;
  tile: TileCoord;
  /** Price (gold per unit) the merchant CHARGES the player. */
  sells: Record<string, number>;
  /** Price (gold per unit) the merchant PAYS the player. */
  buys: Record<string, number>;
}

export const MAINLAND_MERCHANTS: readonly Merchant[] = [
  {
    id: "general-store",
    tile: { col: 2, row: 1 },
    sells: { woodaxe: 25, pickaxe: 30, fishingrod: 15 },
    buys: { wood: 1, stone: 2, fish: 3, hide: 5 },
  },
];

export function findMerchantInZone(
  zoneMerchants: readonly Merchant[],
  id: string,
): Merchant | undefined {
  return zoneMerchants.find((m) => m.id === id);
}
