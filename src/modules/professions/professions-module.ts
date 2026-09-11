import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import type { Catalog } from "../catalog/ports/catalog.ts";
import type { FarmCatalog } from "../catalog/ports/farm-catalog.ts";
import type { CharacterService } from "../character/application/character-service.ts";
import type { InventoryService } from "../inventory/domain/inventory-service.ts";
import type { WorldService } from "../world/domain/world-service.ts";
import { ProfessionsService } from "./application/professions-service.ts";
import type { FarmRng } from "./domain/farm-formulas.ts";
import { PostgresFarmStockProjection } from "./infrastructure/postgres-farm-stock-projection.ts";
import { PostgresFarmStockRepository } from "./infrastructure/postgres-farm-stock-repository.ts";
import { PostgresHeroAssistantRepository } from "./infrastructure/postgres-hero-assistant-repository.ts";
import { PostgresHeroFarmStatRepository } from "./infrastructure/postgres-hero-farm-stat-repository.ts";
import type { FarmStockProjection } from "./ports/farm-stock-projection.ts";

export class ProfessionsModule {
  private constructor(
    readonly service: ProfessionsService,
    readonly farmStocks: FarmStockProjection,
  ) {}

  static create(input: {
    database: PostgresDatabase;
    catalog: Catalog & FarmCatalog;
    characters: CharacterService;
    inventory: InventoryService;
    world: WorldService;
    clock: Clock;
    random: FarmRng;
  }): ProfessionsModule {
    const database = requirePresent(input.database, "Professions module requires a database");
    const catalog = requirePresent(input.catalog, "Professions module requires a catalog");
    const characters = requirePresent(input.characters, "Professions module requires characters");
    const inventory = requirePresent(input.inventory, "Professions module requires inventory");
    const world = requirePresent(input.world, "Professions module requires world");
    const clock = requirePresent(input.clock, "Professions module requires a clock");
    const random = requirePresent(input.random, "Professions module requires a random source");
    return new ProfessionsModule(
      new ProfessionsService(
        new PostgresHeroAssistantRepository(database),
        new PostgresFarmStockRepository(database),
        new PostgresHeroFarmStatRepository(database),
        catalog,
        characters,
        inventory,
        world,
        clock,
        database,
        random,
      ),
      new PostgresFarmStockProjection(database),
    );
  }

  async close(): Promise<void> {}
}
