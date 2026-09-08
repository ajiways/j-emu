import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { CatalogProgression } from "../../catalog/ports/catalog-progression.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { requiredSkillTotal, totalHeroSkills } from "../domain/equipment-skill-totals.ts";
import { CharacterNotFoundError } from "../domain/character-not-found-error.ts";
import { ExperienceGrantConflictError } from "../domain/experience-grant-conflict-error.ts";
import type { ExperienceGrantCommand } from "../domain/experience-grant-command.ts";
import type { ExperienceGrantResult } from "../domain/experience-grant-result.ts";
import { parseExperienceGrantCommand } from "../domain/parse-experience-grant-command.ts";
import { planExperienceTransition } from "../domain/plan-experience-transition.ts";
import { ProgressionContentError } from "../domain/progression-content-error.ts";
import { requireHeroSkills } from "../domain/hero-skill.ts";
import type { CharacterProgression } from "../ports/character-progression.ts";
import type { EquippedModifiers } from "../ports/equipped-modifiers.ts";
import type { ExperienceGrantRepository } from "../ports/experience-grant-repository.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { HeroSkillRepository } from "../ports/hero-skill-repository.ts";

export class ExperienceGrantService implements CharacterProgression {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly heroes: HeroRepository,
    private readonly skills: HeroSkillRepository,
    private readonly grants: ExperienceGrantRepository,
    private readonly progression: CatalogProgression,
    private readonly equipment: EquippedModifiers,
  ) {}

  grantExperience(command: ExperienceGrantCommand): Promise<ExperienceGrantResult> {
    const parsed = parseExperienceGrantCommand(command);
    return this.unitOfWork.run(() => this.apply(parsed));
  }

  private async apply(command: ExperienceGrantCommand): Promise<ExperienceGrantResult> {
    const hero = await this.heroes.lockById(command.characterId);
    if (!hero) throw new CharacterNotFoundError(command.characterId);
    const existing = await this.grants.find(hero.id, command.operationId);
    if (existing) {
      if (existing.amount !== command.amount) {
        throw new ExperienceGrantConflictError(command.operationId);
      }
      return {
        expBefore: existing.expBefore,
        expAfter: existing.expAfter,
        levelBefore: existing.levelBefore,
        levelAfter: existing.levelAfter,
        levelsGained: existing.levelsGained,
        contentReleaseId: existing.contentReleaseId,
        progressionDigest: existing.progressionDigest,
      };
    }
    const snapshot = await this.requireSnapshot();
    const expBefore = hero.exp;
    const levelBefore = hero.level;
    const transition = planExperienceTransition({
      exp: expBefore,
      level: levelBefore,
      skills: requireHeroSkills(await this.skills.list(hero.id)),
      snapshot,
      amount: command.amount,
    });
    const bonuses = await this.requireModifiers(hero.id, snapshot.contentReleaseId);
    const nextSkills = [...transition.nextManaged, ...transition.miscSkills];
    const totals = totalHeroSkills(nextSkills, bonuses);
    hero.applyProgression(
      transition.expAfter,
      transition.levelAfter,
      requiredSkillTotal(totals, "VIT"),
      requiredSkillTotal(totals, "MPMAX"),
    );
    const result: ExperienceGrantResult = {
      expBefore,
      expAfter: transition.expAfter,
      levelBefore,
      levelAfter: transition.levelAfter,
      levelsGained: transition.levelAfter - levelBefore,
      contentReleaseId: snapshot.contentReleaseId,
      progressionDigest: snapshot.progressionDigest,
    };
    await this.skills.replace(hero.id, nextSkills);
    await this.heroes.save(hero);
    await this.grants.insert({
      heroId: hero.id,
      operationId: command.operationId,
      amount: command.amount,
      ...result,
    });
    return result;
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
