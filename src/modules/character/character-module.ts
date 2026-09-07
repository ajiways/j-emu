import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { CharacterService } from "./application/character-service.ts";
import type { HeroCreationPolicy } from "./domain/hero.ts";
import { Hero } from "./domain/hero.ts";
import { PostgresHeroRepository } from "./infrastructure/postgres-hero-repository.ts";

export class CharacterModule {
  private constructor(readonly service: CharacterService) {}

  static create(input: {
    database: PostgresDatabase;
    creationPolicy: HeroCreationPolicy;
  }): CharacterModule {
    const database = requirePresent(input.database, "Character module requires a database");
    const creationPolicy = requirePresent(
      input.creationPolicy,
      "Character module requires a hero creation policy",
    );
    Hero.assertCreationPolicy(creationPolicy);
    return new CharacterModule(
      new CharacterService(new PostgresHeroRepository(database), creationPolicy),
    );
  }

  async close(): Promise<void> {}
}
