export type HeroReputationValue = Readonly<{
  objectId: number;
  value: number;
}>;

export interface HeroReputationRepository {
  listByHeroId(heroId: number): Promise<readonly HeroReputationValue[]>;
  upsert(heroId: number, objectId: number, value: number): Promise<void>;
}
