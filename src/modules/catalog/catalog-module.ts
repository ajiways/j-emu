import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { PostgresActiveContentRevision } from "../content/infrastructure/postgres-active-content-revision.ts";
import type { Catalog } from "./ports/catalog.ts";
import type { CatalogProgression } from "./ports/catalog-progression.ts";
import type { ReleaseArtifacts } from "./ports/release-artifacts.ts";
import { PostgresCatalog } from "./infrastructure/postgres-catalog.ts";
import { PostgresCatalogProgression } from "./infrastructure/postgres-catalog-progression.ts";
import { PostgresReleaseArtifacts } from "./infrastructure/postgres-release-artifacts.ts";

export class CatalogModule {
  private constructor(
    readonly catalog: Catalog,
    readonly progression: CatalogProgression,
    readonly releaseArtifacts: ReleaseArtifacts,
  ) {}

  static async create(input: { database: PostgresDatabase }): Promise<CatalogModule> {
    const database = requirePresent(input.database, "Catalog module requires a database");
    const revision = new PostgresActiveContentRevision(database);
    await revision.requireId();
    return new CatalogModule(
      new PostgresCatalog(database, revision),
      new PostgresCatalogProgression(database, revision),
      new PostgresReleaseArtifacts(database),
    );
  }

  async close(): Promise<void> {}
}
