import type { Hero, HeroCreationPolicy } from "../domain/hero.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";

export class CharacterService {
  constructor(
    private readonly heroes: HeroRepository,
    private readonly creationPolicy: HeroCreationPolicy,
  ) {}

  async getOrCreateForAccount(accountId: string, nick: string): Promise<Hero> {
    const existing = await this.heroes.findByAccountId(accountId);
    if (existing) return existing;
    return this.heroes.create(accountId, nick, this.creationPolicy);
  }

  async getByAccountId(accountId: string): Promise<Hero | null> {
    return this.heroes.findByAccountId(accountId);
  }

  async save(hero: Hero): Promise<void> {
    await this.heroes.save(hero);
  }
}
