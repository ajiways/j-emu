import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { ReleaseArtifacts } from "../catalog/ports/release-artifacts.ts";
import { InventoryService, type StarterItemSpec } from "./domain/inventory-service.ts";
import { PostgresInventoryRepository } from "./infrastructure/postgres-inventory-repository.ts";

export class InventoryModule {
  private constructor(readonly service: InventoryService) {}

  static create(input: {
    database: PostgresDatabase;
    starterItems: readonly StarterItemSpec[];
    releaseArtifacts: ReleaseArtifacts;
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
    return new InventoryModule(
      new InventoryService(
        new PostgresInventoryRepository(database),
        starterItems,
        releaseArtifacts,
      ),
    );
  }

  async close(): Promise<void> {}
}
