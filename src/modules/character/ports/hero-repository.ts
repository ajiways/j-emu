import type { Hero, NewHero } from "../domain/hero.ts";

export interface HeroRepository {
  findById(id: number): Promise<Hero | null>;
  findByAccountId(accountId: number): Promise<Hero | null>;
  listByAreaId(areaId: string): Promise<readonly Hero[]>;
  lockByAccountId(accountId: number): Promise<Hero | null>;
  lockById(id: number): Promise<Hero | null>;
  create(values: NewHero): Promise<Hero>;
  save(hero: Hero): Promise<void>;
}
