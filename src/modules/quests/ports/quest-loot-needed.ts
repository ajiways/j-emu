export interface QuestLootNeeded {
  needed(heroId: number, artikulId: number, ownedInBag: number): Promise<number | null>;
}
