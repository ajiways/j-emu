import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Catalog } from "../catalog/ports/catalog.ts";
import type { ReleaseArtifacts } from "../catalog/ports/release-artifacts.ts";
import { InventoryService, type StarterItemSpec } from "./domain/inventory-service.ts";
import { PostgresInventoryRepository } from "./infrastructure/postgres-inventory-repository.ts";

export class InventoryModule {
  private constructor(readonly service: InventoryService) {}

  static create(input: {
    database: PostgresDatabase;
    starterItems: readonly StarterItemSpec[];
    releaseArtifacts: ReleaseArtifacts;
    catalog: Catalog;
    bagCapacity: number;
    pocketCapacity: number;
    random: Readonly<{ unit(): number }>;
  }): InventoryModule {
    const database = requirePresent(input.database, "Inventory module requires a database");
    const starterItems = requirePresent(
      input.starterItems,
      "Inventory module requires starter items",
    );
    const releaseArtifacts = requirePresent(
      input.releaseArtifacts,
      "Inventory module requires release artifacts",
    );
    const catalog = requirePresent(input.catalog, "Inventory module requires a catalog");
    const bagCapacity = requirePresent(input.bagCapacity, "Inventory module requires bag capacity");
    const pocketCapacity = requirePresent(
      input.pocketCapacity,
      "Inventory module requires pocket capacity",
    );
    const random = requirePresent(input.random, "Inventory module requires a random source");
    return new InventoryModule(
      new InventoryService(
        new PostgresInventoryRepository(database),
        starterItems,
        releaseArtifacts,
        catalog,
        bagCapacity,
        pocketCapacity,
        random,
      ),
    );
  }

  async close(): Promise<void> {}
}
