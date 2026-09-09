export class BotLootEntry {
  constructor(
    readonly artikulId: number,
    readonly dropWeight: number,
    readonly countMin: number,
    readonly countMax: number,
  ) {
    if (!Number.isInteger(artikulId) || artikulId <= 0) {
      throw new Error("Bot loot artikul id is invalid");
    }
    if (!Number.isInteger(dropWeight) || dropWeight < 0) {
      throw new Error(`Bot loot ${artikulId} dropWeight is invalid`);
    }
    if (!Number.isInteger(countMin) || countMin < 1) {
      throw new Error(`Bot loot ${artikulId} countMin is invalid`);
    }
    if (!Number.isInteger(countMax) || countMax < countMin) {
      throw new Error(`Bot loot ${artikulId} countMax is invalid`);
    }
  }
}
