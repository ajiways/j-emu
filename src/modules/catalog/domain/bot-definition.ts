import type { BotReward } from "./bot-reward.ts";
import type { BotSpellBook } from "./bot-spell-book.ts";
import type { HuntLook } from "./hunt-look.ts";

export class BotDefinition {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly level: number,
    readonly maxHp: number,
    readonly strength: number,
    readonly hunt: HuntLook,
    readonly reward: BotReward,
    readonly spellBook: BotSpellBook,
  ) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid bot id");
    if (!title) throw new Error("Bot title is required");
    if (!Number.isInteger(level) || level < 1) throw new Error(`Bot ${id} level is invalid`);
    if (!Number.isInteger(maxHp) || maxHp < 1) throw new Error(`Bot ${id} maxHp is invalid`);
    if (!Number.isInteger(strength) || strength < 0) {
      throw new Error(`Bot ${id} strength is invalid`);
    }
  }
}
