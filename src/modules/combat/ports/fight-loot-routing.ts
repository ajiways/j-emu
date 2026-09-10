export type FightLootRoute = Readonly<{
  partyId: number;
  lootRules: "1" | "2" | "3";
  memberCharacterIds: ReadonlySet<number>;
}>;

export interface FightLootRouting {
  routeFor(characterIds: readonly number[]): Promise<FightLootRoute | null>;
}
