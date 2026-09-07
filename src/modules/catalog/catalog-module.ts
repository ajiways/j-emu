import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { PostgresActiveContentRevision } from "../content/infrastructure/postgres-active-content-revision.ts";
import type { Catalog } from "./ports/catalog.ts";
import { PostgresCatalog } from "./infrastructure/postgres-catalog.ts";

export class CatalogModule {
  private constructor(readonly catalog: Catalog) {}

  static async create(input: { database: PostgresDatabase }): Promise<CatalogModule> {
    const database = requirePresent(input.database, "Catalog module requires a database");
    const revision = new PostgresActiveContentRevision(database);
    await revision.requireId();
    return new CatalogModule(new PostgresCatalog(database, revision));
  }

  async close(): Promise<void> {}
}
