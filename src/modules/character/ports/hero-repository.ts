import type { Hero, HeroCreationPolicy } from "../domain/hero.ts";

export interface HeroRepository {
  findById(id: string): Promise<Hero | null>;
  findByAccountId(accountId: string): Promise<Hero | null>;
  create(accountId: string, nick: string, policy: HeroCreationPolicy): Promise<Hero>;
  save(hero: Hero): Promise<void>;
}
