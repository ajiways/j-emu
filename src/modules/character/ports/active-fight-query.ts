export interface ActiveFightQuery {
  isHeroInActiveFight(characterId: number): Promise<boolean>;
}
