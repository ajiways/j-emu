import type { BotSource } from "./bot-source.ts";
import { EMPTY_BOT_SPELL_NOTHING_WEIGHT } from "./hunt-look-policy.ts";

export type GeneratedBotDocument = Readonly<{
  id: number;
  title: string;
  level: number;
  maxHp: number;
  strength: number;
  hunt: BotSource["hunt"];
  baseExp: number;
  moneyMin: number;
  moneyMax: number;
  lootDropCnt: 0;
  lootBonusChance: 0;
  lootBonusMin: 0;
  lootBonusMax: 0;
  lootNothingWeight: 0;
  lootEntries: readonly [];
  spellBook: Readonly<{ nothingWeight: number; spells: readonly [] }>;
}>;

export function botDocumentsFromSources(bots: readonly BotSource[]): GeneratedBotDocument[] {
  return bots.map((bot) => {
    if (bot.moneyMin < 0 || bot.moneyMax < 0) {
      throw new Error(`bot ${bot.id} money must be non-negative`);
    }
    if (!bot.hunt.nick) throw new Error(`bot ${bot.id} hunt nick is required`);
    return {
      id: bot.id,
      title: bot.title,
      level: bot.level,
      maxHp: bot.maxHp,
      strength: bot.strength,
      hunt: bot.hunt,
      baseExp: bot.baseExp,
      moneyMin: bot.moneyMin,
      moneyMax: bot.moneyMax,
      lootDropCnt: 0,
      lootBonusChance: 0,
      lootBonusMin: 0,
      lootBonusMax: 0,
      lootNothingWeight: 0,
      lootEntries: [],
      spellBook: { nothingWeight: EMPTY_BOT_SPELL_NOTHING_WEIGHT, spells: [] },
    };
  });
}
