import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import type { CatalogProgression } from "../catalog/ports/catalog-progression.ts";
import type { ReputationCatalog } from "../catalog/ports/reputation-catalog.ts";
import { CharacterService } from "./application/character-service.ts";
import type { HeroCreationPolicy } from "./domain/hero.ts";
import { Hero } from "./domain/hero.ts";
import type { RegenPolicy } from "./domain/regen-policy.ts";
import { PostgresExperienceGrantRepository } from "./infrastructure/postgres-experience-grant-repository.ts";
import { PostgresHeroBestiary } from "./infrastructure/postgres-hero-bestiary.ts";
import { PostgresHeroLearnedBonusRepository } from "./infrastructure/postgres-hero-learned-bonus-repository.ts";
import { PostgresHeroRepository } from "./infrastructure/postgres-hero-repository.ts";
import { PostgresHeroReputationRepository } from "./infrastructure/postgres-hero-reputation-repository.ts";
import { PostgresHeroSkillRepository } from "./infrastructure/postgres-hero-skill-repository.ts";
import { PostgresPersonalDetailsRepository } from "./infrastructure/postgres-personal-details-repository.ts";
import type { ActiveFightQuery } from "./ports/active-fight-query.ts";
import type { EquippedModifiers } from "./ports/equipped-modifiers.ts";
import type { HeroBestiary } from "./ports/hero-bestiary.ts";

export class CharacterModule {
  private constructor(
    readonly service: CharacterService,
    readonly bestiary: HeroBestiary,
  ) {}

  static create(input: {
    database: PostgresDatabase;
    creationPolicy: HeroCreationPolicy;
    progression: CatalogProgression;
    reputationCatalog: ReputationCatalog;
    equipmentModifiers: EquippedModifiers;
    clock: Clock;
    regenPolicy: RegenPolicy;
    activeFight: ActiveFightQuery;
  }): CharacterModule {
    const database = requirePresent(input.database, "Character module requires a database");
    const creationPolicy = requirePresent(
      input.creationPolicy,
      "Character module requires a hero creation policy",
    );
    const progression = requirePresent(
      input.progression,
      "Character module requires catalog progression",
    );
    const reputationCatalog = requirePresent(
      input.reputationCatalog,
      "Character module requires a reputation catalog",
    );
    const equipmentModifiers = requirePresent(
      input.equipmentModifiers,
      "Character module requires equipped modifiers",
    );
    const clock = requirePresent(input.clock, "Character module requires a clock");
    const regenPolicy = requirePresent(
      input.regenPolicy,
      "Character module requires a regen policy",
    );
    const activeFight = requirePresent(
      input.activeFight,
      "Character module requires an active-fight query",
    );
    Hero.assertCreationPolicy(creationPolicy);
    if (!Number.isInteger(regenPolicy.k) || regenPolicy.k < 1) {
      throw new Error("RegenPolicy.k must be a positive integer");
    }
    if (regenPolicy.provenance !== "legacy behavior / empirical") {
      throw new Error("RegenPolicy provenance must be legacy behavior / empirical");
    }
    const heroes = new PostgresHeroRepository(database);
    const skills = new PostgresHeroSkillRepository(database);
    return new CharacterModule(
      new CharacterService(
        database,
        heroes,
        new PostgresHeroReputationRepository(database),
        skills,
        new PostgresHeroLearnedBonusRepository(database),
        new PostgresPersonalDetailsRepository(database),
        creationPolicy,
        progression,
        reputationCatalog,
        equipmentModifiers,
        new PostgresExperienceGrantRepository(database),
        clock,
        regenPolicy,
        activeFight,
      ),
      new PostgresHeroBestiary(database),
    );
  }

  async close(): Promise<void> {}
}
