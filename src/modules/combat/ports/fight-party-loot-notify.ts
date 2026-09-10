import type { FightArtikulListWire } from "../domain/fight-loot-block.ts";

export type FightPartyLootNotice = Readonly<{
  partyId: number;
  fightId: string;
  lootRules: "1" | "2" | "3";
  moneyMinor: number;
  items: readonly { artikulId: number; quantity: number }[];
  artikulList: readonly FightArtikulListWire[];
}>;

export interface FightPartyLootNotify {
  notify(notice: FightPartyLootNotice): Promise<void>;
}
