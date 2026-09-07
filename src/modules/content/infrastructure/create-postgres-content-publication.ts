import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { PostgresCatalogProjection } from "../../catalog/infrastructure/postgres-catalog-projection.ts";
import { PostgresWorldProjection } from "../../world/infrastructure/postgres-world-projection.ts";
import { ContentPublicationService } from "../application/content-publication-service.ts";
import { ContentValidator } from "../application/content-validator.ts";
import { PostgresContentStore } from "./postgres-content-store.ts";

export function createPostgresContentPublication(
  database: PostgresDatabase,
): ContentPublicationService {
  return new ContentPublicationService(
    database,
    new PostgresContentStore(database),
    new PostgresCatalogProjection(database),
    new PostgresWorldProjection(database),
    new ContentValidator(),
  );
}
