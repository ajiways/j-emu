export interface HeroLearnedBonusRepository {
  has(heroId: number, bonusId: number): Promise<boolean>;
  insert(heroId: number, bonusId: number, artikulId: number): Promise<void>;
}
