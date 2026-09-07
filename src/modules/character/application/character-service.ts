import type { Hero, HeroCreationPolicy } from "../domain/hero.ts";
import { PersonalDetails } from "../domain/personal-details.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { PersonalDetailsRepository } from "../ports/personal-details-repository.ts";

export class CharacterService {
  constructor(
    private readonly heroes: HeroRepository,
    private readonly personalDetailsStore: PersonalDetailsRepository,
    private readonly creationPolicy: HeroCreationPolicy,
  ) {}

  async getOrCreateForAccount(accountId: number, nick: string): Promise<Hero> {
    const existing = await this.heroes.findByAccountId(accountId);
    if (existing) return existing;
    return this.heroes.create(accountId, nick, this.creationPolicy);
  }

  async getByAccountId(accountId: number): Promise<Hero | null> {
    return this.heroes.findByAccountId(accountId);
  }

  async save(hero: Hero): Promise<void> {
    await this.heroes.save(hero);
  }

  async personalDetails(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    return (await this.storedDetails(hero.id)).info;
  }

  async mergePersonalDetails(
    accountId: number,
    patch: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const next = (await this.storedDetails(hero.id)).merge(patch);
    await this.personalDetailsStore.save(hero.id, next);
    return next.info;
  }

  private async storedDetails(heroId: number): Promise<PersonalDetails> {
    const stored = await this.personalDetailsStore.findByHeroId(heroId);
    if (!stored) return PersonalDetails.empty();
    return stored;
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.heroes.findByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
