import type { BotLootEntry } from "./bot-loot-entry.ts";

export class BotReward {
  constructor(
    readonly baseExp: number,
    readonly moneyMin: number,
    readonly moneyMax: number,
    readonly lootDropCnt: number,
    readonly lootBonusChance: number,
    readonly lootBonusMin: number,
    readonly lootBonusMax: number,
    readonly lootNothingWeight: number,
    readonly lootEntries: readonly BotLootEntry[],
  ) {
    if (!Number.isInteger(baseExp) || baseExp < 0) throw new Error("Bot baseExp is invalid");
    if (!Number.isFinite(moneyMin) || moneyMin < 0) throw new Error("Bot moneyMin is invalid");
    if (!Number.isFinite(moneyMax) || moneyMax < moneyMin) {
      throw new Error("Bot moneyMax is invalid");
    }
    if (!Number.isInteger(lootDropCnt) || lootDropCnt < 0) {
      throw new Error("Bot lootDropCnt is invalid");
    }
    if (!Number.isFinite(lootBonusChance) || lootBonusChance < 0 || lootBonusChance > 1) {
      throw new Error("Bot lootBonusChance is invalid");
    }
    if (!Number.isInteger(lootBonusMin) || lootBonusMin < 0) {
      throw new Error("Bot lootBonusMin is invalid");
    }
    if (!Number.isInteger(lootBonusMax) || lootBonusMax < lootBonusMin) {
      throw new Error("Bot lootBonusMax is invalid");
    }
    if (!Number.isInteger(lootNothingWeight) || lootNothingWeight < 0) {
      throw new Error("Bot lootNothingWeight is invalid");
    }
    const seen = new Set<number>();
    for (const entry of lootEntries) {
      if (seen.has(entry.artikulId)) {
        throw new Error(`Duplicate bot loot artikul ${entry.artikulId}`);
      }
      seen.add(entry.artikulId);
    }
  }
}
