import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { PostgresActiveContentRevision } from "../content/infrastructure/postgres-active-content-revision.ts";
import { HuntSpawnOverlay } from "./domain/hunt-spawn-overlay.ts";
import { WorldService } from "./domain/world-service.ts";
import { PostgresWorldRepository } from "./infrastructure/postgres-world-repository.ts";

export class WorldModule {
  private constructor(readonly service: WorldService) {}

  static async create(input: { database: PostgresDatabase }): Promise<WorldModule> {
    const database = requirePresent(input.database, "World module requires a database");
    const revision = new PostgresActiveContentRevision(database);
    await revision.requireId();
    return new WorldModule(
      new WorldService(new PostgresWorldRepository(database, revision), new HuntSpawnOverlay()),
    );
  }

  async close(): Promise<void> {}
}
