import type { HeroFarmStat } from "../domain/hero-assistant.ts";

export interface HeroFarmStatRepository {
  bump(heroId: number, farmId: number): Promise<void>;
  listByHero(heroId: number): Promise<readonly HeroFarmStat[]>;
}
