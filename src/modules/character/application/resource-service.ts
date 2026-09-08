import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { CatalogProgression } from "../../catalog/ports/catalog-progression.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { CharacterNotFoundError } from "../domain/character-not-found-error.ts";
import { totalHeroSkills } from "../domain/equipment-skill-totals.ts";
import { requireHeroSkills } from "../domain/hero-skill.ts";
import type { Hero } from "../domain/hero.ts";
import {
  applyElapsedHpRegen,
  remainingHpSeconds,
  truncatedUnixDate,
  unixSecondsOf,
} from "../domain/hp-regen.ts";
import { InvalidNoteHpError } from "../domain/invalid-note-hp-error.ts";
import { MissingHpregError } from "../domain/missing-hpreg-error.ts";
import { parseCharacterId } from "../domain/parse-resource-command.ts";
import { ProgressionContentError } from "../domain/progression-content-error.ts";
import type { RegenPolicy } from "../domain/regen-policy.ts";
import type { ActiveFightQuery } from "../ports/active-fight-query.ts";
import type {
  CharacterResources,
  NoteHpCommand,
  ResourceSnapshot,
  SyncResourcesCommand,
} from "../ports/character-resources.ts";
import type { EquippedModifiers } from "../ports/equipped-modifiers.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { HeroSkillRepository } from "../ports/hero-skill-repository.ts";

export class ResourceService implements CharacterResources {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly heroes: HeroRepository,
    private readonly skills: HeroSkillRepository,
    private readonly progression: CatalogProgression,
    private readonly equipment: EquippedModifiers,
    private readonly clock: Clock,
    private readonly policy: RegenPolicy,
    private readonly activeFight: ActiveFightQuery,
  ) {}

  syncResources(command: SyncResourcesCommand): Promise<ResourceSnapshot> {
    const characterId = parseCharacterId(command.characterId);
    return this.unitOfWork.run(async () => {
      const hero = await this.requireLocked(characterId);
      return this.applyElapsedToLocked(hero);
    });
  }

  noteHp(command: NoteHpCommand): Promise<ResourceSnapshot> {
    const characterId = parseCharacterId(command.characterId);
    return this.unitOfWork.run(async () => {
      const hero = await this.requireLocked(characterId);
      if (!Number.isInteger(command.hp) || command.hp < 0 || command.hp > hero.maxHp) {
        throw new InvalidNoteHpError(command.hp, hero.maxHp);
      }
      const hpreg = await this.hpregFor(hero, hero.maxHp - command.hp);
      const hpTime = remainingHpSeconds(hero.maxHp - command.hp, hpreg, this.policy.k, hero.id);
      hero.applyResourceClock(command.hp, hpTime, truncatedUnixDate(this.clock));
      await this.heroes.save(hero);
      return resourceSnapshot(hero, false, true);
    });
  }

  async applyElapsedToLocked(hero: Hero): Promise<ResourceSnapshot> {
    const inFight = await this.activeFight.isHeroInActiveFight(hero.id);
    if (inFight) return resourceSnapshot(hero, true, false);
    const hpreg = await this.hpregFor(hero, hero.maxHp - hero.hp);
    const next = applyElapsedHpRegen({
      hp: hero.hp,
      hpMax: hero.maxHp,
      regenAtSec: unixSecondsOf(hero.regenAt),
      nowSec: this.clock.unixSeconds(),
      hpreg,
      k: this.policy.k,
      characterId: hero.id,
    });
    if (next.hp === hero.hp && next.hpTime === hero.hpTime) {
      return resourceSnapshot(hero, false, false);
    }
    hero.applyResourceClock(next.hp, next.hpTime, truncatedUnixDate(this.clock));
    await this.heroes.save(hero);
    return resourceSnapshot(hero, false, true);
  }

  async recomputeHpTimeAfterMutation(hero: Hero): Promise<void> {
    if (await this.activeFight.isHeroInActiveFight(hero.id)) return;
    const hpreg = await this.hpregFor(hero, hero.maxHp - hero.hp);
    const hpTime = remainingHpSeconds(hero.maxHp - hero.hp, hpreg, this.policy.k, hero.id);
    hero.applyResourceClock(hero.hp, hpTime, truncatedUnixDate(this.clock));
  }

  private async requireLocked(characterId: number): Promise<Hero> {
    const hero = await this.heroes.lockById(characterId);
    if (!hero) throw new CharacterNotFoundError(characterId);
    return hero;
  }

  private async hpregFor(hero: Hero, deficit: number): Promise<number> {
    if (deficit <= 0) return 0;
    const snapshot = await this.requireSnapshot();
    const bonuses = await this.requireModifiers(hero.id, snapshot.contentReleaseId);
    const naked = requireHeroSkills(await this.skills.list(hero.id));
    const totals = totalHeroSkills(naked, bonuses);
    const skill = totals.find((entry) => entry.id === "HPREG");
    if (!skill || !Number.isInteger(skill.value) || skill.value < 1) {
      throw new MissingHpregError(hero.id);
    }
    return skill.value;
  }

  private async requireSnapshot() {
    try {
      return await this.progression.progressionSnapshot();
    } catch (error) {
      throw new ProgressionContentError(
        error instanceof Error ? error.message : "Progression content is invalid",
      );
    }
  }

  private async requireModifiers(
    characterId: number,
    releaseId: string,
  ): Promise<readonly ArtifactSkillBonus[]> {
    try {
      return await this.equipment.modifiersForHero(characterId, releaseId);
    } catch (error) {
      throw new ProgressionContentError(
        error instanceof Error ? error.message : "Equipment modifiers are invalid",
      );
    }
  }
}

function resourceSnapshot(hero: Hero, inFight: boolean, persisted: boolean): ResourceSnapshot {
  return {
    characterId: hero.id,
    hp: hero.hp,
    maxHp: hero.maxHp,
    hpTime: inFight ? 0 : hero.hpTime,
    regenAt: hero.regenAt,
    inActiveFight: inFight,
    persisted,
  };
}
