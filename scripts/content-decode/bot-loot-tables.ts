import type { OverlayBot } from "./bot-overlays.ts";
import type { BotSource } from "./bot-source.ts";
import {
  authoredLootTable,
  buildLootTableFromIds,
  type ArtikulLootMeta,
  type LootTable,
} from "./dwar-lite-loot.ts";

export type BotLootDocument = Readonly<{
  botId: number;
  lootDropCnt: number;
  lootBonusChance: number;
  lootBonusMin: number;
  lootBonusMax: number;
  lootNothingWeight: number;
  lootEntries: readonly Readonly<{
    artikulId: number;
    dropWeight: number;
    countMin: number;
    countMax: number;
  }>[];
}>;

export function lootDocumentsForBots(
  bots: readonly BotSource[],
  overlayById: ReadonlyMap<number, OverlayBot>,
  artikulById: ReadonlyMap<number, ArtikulLootMeta>,
): BotLootDocument[] {
  return bots.map((bot) => {
    const overlay = overlayById.get(bot.id);
    const table = overlay?.loot
      ? authoredLootTable({
          dropCnt: overlay.loot.dropCnt,
          bonusChance: overlay.loot.bonusChance,
          bonusMin: overlay.loot.bonusMin,
          bonusMax: overlay.loot.bonusMax,
          nothingWeight: overlay.loot.nothingWeight,
          entries: overlay.loot.entries,
        })
      : buildLootTableFromIds(
          bot.dropIds,
          { level: bot.level, ultrabeast: bot.ultrabeast },
          artikulById,
        );
    assertLootRefs(bot.id, table, artikulById);
    return {
      botId: bot.id,
      lootDropCnt: table.dropCnt,
      lootBonusChance: table.bonusChance,
      lootBonusMin: table.bonusMin,
      lootBonusMax: table.bonusMax,
      lootNothingWeight: table.nothingWeight,
      lootEntries: table.entries,
    };
  });
}

function assertLootRefs(
  botId: number,
  table: LootTable,
  artikulById: ReadonlyMap<number, ArtikulLootMeta>,
): void {
  for (const entry of table.entries) {
    if (!artikulById.has(entry.artikulId)) {
      throw new Error(`bot ${botId} loot artikul ${entry.artikulId} is not in the item corpus`);
    }
  }
}
