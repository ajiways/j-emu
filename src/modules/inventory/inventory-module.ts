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
    return new InventoryModule(
      new InventoryService(
        new PostgresInventoryRepository(database),
        starterItems,
        releaseArtifacts,
        catalog,
        bagCapacity,
      ),
    );
  }

  async close(): Promise<void> {}
}
