import type { Hero, HeroCreationPolicy } from "../domain/hero.ts";

export interface HeroRepository {
  findById(id: number): Promise<Hero | null>;
  findByAccountId(accountId: number): Promise<Hero | null>;
  create(accountId: number, nick: string, policy: HeroCreationPolicy): Promise<Hero>;
  save(hero: Hero): Promise<void>;
}
