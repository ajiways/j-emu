import type { ArtifactBonus } from "../../catalog/domain/artifact-bonus.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { CatalogProgression } from "../../catalog/ports/catalog-progression.ts";
import type { ReputationCatalog } from "../../catalog/ports/reputation-catalog.ts";
import type { ProgressionSnapshot } from "../../catalog/domain/progression-snapshot.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { Hero, HeroCreationPolicy } from "../domain/hero.ts";
import { truncatedUnixDate } from "../domain/hp-regen.ts";
import { PersonalDetails } from "../domain/personal-details.ts";
import { requiredSkillTotal, totalHeroSkills } from "../domain/equipment-skill-totals.ts";
import { requireHeroSkills, type HeroSkill } from "../domain/hero-skill.ts";
import { planLearnBonus } from "../domain/plan-learn-bonus.ts";
import { ProgressionContentError } from "../domain/progression-content-error.ts";
import type { RegenPolicy } from "../domain/regen-policy.ts";
import type { ActiveFightQuery } from "../ports/active-fight-query.ts";
import type { EquippedModifiers } from "../ports/equipped-modifiers.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { HeroLearnedBonusRepository } from "../ports/hero-learned-bonus-repository.ts";
import type { HeroSkillRepository } from "../ports/hero-skill-repository.ts";
import type { PersonalDetailsRepository } from "../ports/personal-details-repository.ts";
import { ExperienceGrantService } from "./experience-grant-service.ts";
import { ResourceService } from "./resource-service.ts";
import { toPresenceHero } from "./to-presence-hero.ts";
import type { ExperienceGrantCommand } from "../domain/experience-grant-command.ts";
import type { ExperienceGrantResult } from "../domain/experience-grant-result.ts";
import type { CharacterProgression } from "../ports/character-progression.ts";
import type {
  CharacterMoney,
  CreditMoneyCommand,
  DebitMoneyCommand,
} from "../ports/character-money.ts";
import { creditHeroMoney, debitHeroMoney } from "./apply-hero-money.ts";
import type {
  CharacterResources,
  NoteDefeatCommand,
  NoteHpCommand,
  NoteMpCommand,
  ResourceSnapshot,
  ResurrectCommand,
  SyncResourcesCommand,
} from "../ports/character-resources.ts";
import type { CharacterLocation, SetAreaCommand } from "../ports/character-location.ts";
import type { CharacterPresence, PresenceHero } from "../ports/character-presence.ts";
import type {
  CharacterReputation,
  GrantReputationCommand,
  GrantReputationResult,
  HeroReputationRow,
} from "../ports/character-reputation.ts";
import type { ExperienceGrantRepository } from "../ports/experience-grant-repository.ts";
import type { HeroReputationRepository } from "../ports/hero-reputation-repository.ts";
import { grantHeroReputation } from "./grant-hero-reputation.ts";

export class CharacterService
  implements
    CharacterProgression,
    CharacterResources,
    CharacterMoney,
    CharacterLocation,
    CharacterPresence,
    CharacterReputation
{
  private readonly grants: ExperienceGrantService;
  private readonly resources: ResourceService;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly heroes: HeroRepository,
    private readonly heroReputations: HeroReputationRepository,
    private readonly skills: HeroSkillRepository,
    private readonly learnedBonuses: HeroLearnedBonusRepository,
    private readonly personalDetailsStore: PersonalDetailsRepository,
    private readonly creationPolicy: HeroCreationPolicy,
    private readonly progression: CatalogProgression,
    private readonly reputationCatalog: ReputationCatalog,
    private readonly equipment: EquippedModifiers,
    grantStore: ExperienceGrantRepository,
    private readonly clock: Clock,
    regenPolicy: RegenPolicy,
    activeFight: ActiveFightQuery,
  ) {
    this.resources = new ResourceService(
      unitOfWork,
      heroes,
      skills,
      progression,
      this.equipment,
      clock,
      regenPolicy,
      activeFight,
    );
    this.grants = new ExperienceGrantService(
      unitOfWork,
      heroes,
      skills,
      grantStore,
      progression,
      this.equipment,
      this.resources,
    );
  }

  grantExperience(command: ExperienceGrantCommand): Promise<ExperienceGrantResult> {
    return this.grants.grantExperience(command);
  }

  syncResources(command: SyncResourcesCommand): Promise<ResourceSnapshot> {
    return this.resources.syncResources(command);
  }

  noteHp(command: NoteHpCommand): Promise<ResourceSnapshot> {
    return this.resources.noteHp(command);
  }

  noteMp(command: NoteMpCommand): Promise<ResourceSnapshot> {
    return this.resources.noteMp(command);
  }

  noteDefeat(command: NoteDefeatCommand): Promise<ResourceSnapshot> {
    return this.resources.noteDefeat(command);
  }

  resurrect(command: ResurrectCommand): Promise<ResourceSnapshot> {
    return this.resources.resurrect(command);
  }

  async creditMoney(command: CreditMoneyCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      await creditHeroMoney(this.heroes, command);
    });
  }

  async debitMoney(command: DebitMoneyCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      await debitHeroMoney(this.heroes, command);
    });
  }

  grantReputation(command: GrantReputationCommand): Promise<GrantReputationResult> {
    return this.unitOfWork.run(() =>
      grantHeroReputation(this.heroes, this.heroReputations, this.reputationCatalog, command),
    );
  }

  async reputations(characterId: number): Promise<readonly HeroReputationRow[]> {
    if (!Number.isInteger(characterId) || characterId < 1) {
      throw new Error("Character id is required");
    }
    return this.heroReputations.listByHeroId(characterId);
  }

  async setArea(command: SetAreaCommand): Promise<void> {
    const hero = await this.heroes.lockById(command.characterId);
    if (!hero) throw new Error(`Hero ${command.characterId} is missing`);
    hero.setArea(command.areaId, command.moveReadyAt);
    await this.heroes.save(hero);
  }

  async getOrCreateForAccount(accountId: number, nick: string): Promise<Hero> {
    return this.unitOfWork.run(async () => {
      const existing = await this.heroes.findByAccountId(accountId);
      if (existing) return existing;
      const snapshot = await this.requireSnapshot();
      const levelOne = snapshot.requireLevel(1);
      const vit = requiredManaged(levelOne.managedSkills, "VIT");
      const mpMax = requiredManaged(levelOne.managedSkills, "MPMAX");
      const hero = await this.heroes.create({
        accountId,
        nick,
        level: 1,
        hp: vit,
        maxHp: vit,
        mp: mpMax,
        maxMp: mpMax,
        exp: this.creationPolicy.exp,
        areaId: this.creationPolicy.areaId,
        moneyMinor: this.creationPolicy.moneyMinor,
        moneyGoldMinor: this.creationPolicy.moneyGoldMinor,
        kind: this.creationPolicy.kind,
        gender: this.creationPolicy.gender,
        language: this.creationPolicy.language,
        body: this.creationPolicy.body,
        sk: this.creationPolicy.sk,
        honor: this.creationPolicy.honor,
        hpTime: 0,
        regenAt: truncatedUnixDate(this.clock),
        moveReadyAt: null,
        ghost: false,
        injuryTime: 0,
        injuryArtikulId: 0,
      });
      await this.skills.replace(hero.id, [
        ...levelOne.managedSkills.map((skill) => ({ id: skill.id, value: skill.value })),
        ...this.creationPolicy.skills,
      ]);
      await this.personalDetailsStore.save(
        hero.id,
        PersonalDetails.fromStored({ ...this.creationPolicy.tutorialInfo }),
      );
      return hero;
    });
  }

  async getByAccountId(accountId: number): Promise<Hero | null> {
    return this.heroes.findByAccountId(accountId);
  }

  async getByNick(nick: string): Promise<Hero | null> {
    const trimmed = nick.trim();
    if (!trimmed) throw new Error("Hero nick is required");
    return this.heroes.findByNick(trimmed);
  }

  async listInArea(areaId: string): Promise<readonly PresenceHero[]> {
    if (!areaId) throw new Error("Area id is required");
    return (await this.heroes.listByAreaId(areaId)).map(toPresenceHero);
  }

  async requirePresence(accountId: number): Promise<PresenceHero> {
    const hero = await this.requireHero(accountId);
    return toPresenceHero(hero);
  }

  async lockByAccountId(accountId: number): Promise<Hero> {
    const hero = await this.heroes.lockByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }

  async lockById(characterId: number): Promise<Hero> {
    const hero = await this.heroes.lockById(characterId);
    if (!hero) throw new Error(`Hero ${characterId} is missing`);
    return hero;
  }

  async combatStrength(characterId: number): Promise<number> {
    if (!Number.isInteger(characterId) || characterId < 1) {
      throw new Error("Character id is required");
    }
    const snapshot = await this.requireSnapshot();
    const naked = requireHeroSkills(await this.skills.list(characterId));
    const bonuses = await this.equipment.modifiersForHero(characterId, snapshot.contentReleaseId);
    return requiredSkillTotal(totalHeroSkills(naked, bonuses), "STR");
  }

  async applyEquipmentVitals(hero: Hero, bonuses: readonly ArtifactSkillBonus[]): Promise<Hero> {
    const naked = requireHeroSkills(await this.skills.list(hero.id));
    const totals = totalHeroSkills(naked, bonuses);
    hero.applyVitals(requiredSkillTotal(totals, "VIT"), requiredSkillTotal(totals, "MPMAX"));
    await this.resources.recomputeHpTimeAfterMutation(hero);
    await this.heroes.save(hero);
    return hero;
  }

  async learnArtifactBonus(command: {
    characterId: number;
    bonus: ArtifactBonus;
    artikulId: number;
  }): Promise<void> {
    const hero = await this.heroes.lockById(command.characterId);
    if (!hero) throw new Error(`Hero ${command.characterId} is missing`);
    const alreadyLearned = await this.learnedBonuses.has(hero.id, command.bonus.id);
    const skills = [...(await this.skills.list(hero.id))];
    const current = skills.find((skill) => skill.id === command.bonus.skillId);
    const currentValue = current === undefined ? 0 : current.value;
    const planned = planLearnBonus({
      bonus: command.bonus,
      currentValue,
      alreadyLearned,
    });
    if (current) {
      const index = skills.findIndex((skill) => skill.id === command.bonus.skillId);
      if (index < 0) throw new Error(`Hero skill ${command.bonus.skillId} is missing after lookup`);
      skills[index] = { id: command.bonus.skillId, value: planned.nextValue };
    } else {
      skills.push({ id: command.bonus.skillId, value: planned.nextValue });
    }
    await this.skills.replace(hero.id, skills);
    await this.learnedBonuses.insert(hero.id, command.bonus.id, command.artikulId);
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

  private async requireSnapshot(): Promise<ProgressionSnapshot> {
    try {
      return await this.progression.progressionSnapshot();
    } catch (error) {
      throw new ProgressionContentError(
        error instanceof Error ? error.message : "Progression content is invalid",
      );
    }
  }
}

function requiredManaged(skills: readonly { id: string; value: number }[], id: string): number {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) throw new ProgressionContentError(`Progression L1 is missing ${id}`);
  if (skill.value < 1) throw new ProgressionContentError(`Progression L1 ${id} must be positive`);
  return skill.value;
}
