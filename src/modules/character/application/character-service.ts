import type { Hero, HeroCreationPolicy } from "../domain/hero.ts";
import { PersonalDetails } from "../domain/personal-details.ts";
import { requiredSkillTotal, totalHeroSkills } from "../domain/equipment-skill-totals.ts";
import { requireHeroSkills, type HeroSkill } from "../domain/hero-skill.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { HeroSkillRepository } from "../ports/hero-skill-repository.ts";
import type { PersonalDetailsRepository } from "../ports/personal-details-repository.ts";

export class CharacterService {
  constructor(
    private readonly heroes: HeroRepository,
    private readonly skills: HeroSkillRepository,
    private readonly personalDetailsStore: PersonalDetailsRepository,
    private readonly creationPolicy: HeroCreationPolicy,
  ) {}

  async getOrCreateForAccount(accountId: number, nick: string): Promise<Hero> {
    const existing = await this.heroes.findByAccountId(accountId);
    if (existing) return existing;
    const hero = await this.heroes.create(accountId, nick, this.creationPolicy);
    await this.skills.replace(hero.id, this.creationPolicy.skills);
    await this.personalDetailsStore.save(
      hero.id,
      PersonalDetails.fromStored({ ...this.creationPolicy.tutorialInfo }),
    );
    return hero;
  }

  async getByAccountId(accountId: number): Promise<Hero | null> {
    return this.heroes.findByAccountId(accountId);
  }

  async lockByAccountId(accountId: number): Promise<Hero> {
    const hero = await this.heroes.lockByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }

  async applyEquipmentVitals(hero: Hero, bonuses: readonly ArtifactSkillBonus[]): Promise<Hero> {
    const naked = requireHeroSkills(await this.skills.list(hero.id));
    const totals = totalHeroSkills(naked, bonuses);
    hero.applyVitals(requiredSkillTotal(totals, "VIT"), requiredSkillTotal(totals, "MPMAX"));
    await this.heroes.save(hero);
    return hero;
  }

  async save(hero: Hero): Promise<void> {
    await this.heroes.save(hero);
  }

  async skillsFor(accountId: number): Promise<readonly HeroSkill[]> {
    const hero = await this.requireHero(accountId);
    return requireHeroSkills(await this.skills.list(hero.id));
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
    if (!stored) throw new Error(`Personal details for hero ${heroId} are missing`);
    return stored;
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.heroes.findByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
