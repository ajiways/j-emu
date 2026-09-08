import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { CatalogProgression } from "../catalog/ports/catalog-progression.ts";
import { CharacterService } from "./application/character-service.ts";
import type { HeroCreationPolicy } from "./domain/hero.ts";
import { Hero } from "./domain/hero.ts";
import { PostgresExperienceGrantRepository } from "./infrastructure/postgres-experience-grant-repository.ts";
import { PostgresHeroRepository } from "./infrastructure/postgres-hero-repository.ts";
import { PostgresHeroSkillRepository } from "./infrastructure/postgres-hero-skill-repository.ts";
import { PostgresPersonalDetailsRepository } from "./infrastructure/postgres-personal-details-repository.ts";
import type { EquippedModifiers } from "./ports/equipped-modifiers.ts";

export class CharacterModule {
  private constructor(readonly service: CharacterService) {}

  static create(input: {
    database: PostgresDatabase;
    creationPolicy: HeroCreationPolicy;
    progression: CatalogProgression;
    equipmentModifiers: EquippedModifiers;
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
    const equipmentModifiers = requirePresent(
      input.equipmentModifiers,
      "Character module requires equipped modifiers",
    );
    Hero.assertCreationPolicy(creationPolicy);
    const heroes = new PostgresHeroRepository(database);
    const skills = new PostgresHeroSkillRepository(database);
    return new CharacterModule(
      new CharacterService(
        database,
        heroes,
        skills,
        new PostgresPersonalDetailsRepository(database),
        creationPolicy,
        progression,
        equipmentModifiers,
        new PostgresExperienceGrantRepository(database),
      ),
    );
  }

  async close(): Promise<void> {}
}
