import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { PostgresCatalogProjection } from "../../catalog/infrastructure/postgres-catalog-projection.ts";
import { PostgresCatalogCompatibility } from "../../catalog/infrastructure/postgres-catalog-compatibility.ts";
import { PostgresWorldProjection } from "../../world/infrastructure/postgres-world-projection.ts";
import { PostgresFarmStockProjection } from "../../professions/infrastructure/postgres-farm-stock-projection.ts";
import { PostgresQuestProjection } from "../../quests/infrastructure/postgres-quest-projection.ts";
import { ContentPublicationService } from "../application/content-publication-service.ts";
import { ContentActivationCompatibility } from "../application/content-activation-compatibility.ts";
import { ContentValidator } from "../application/content-validator.ts";
import { PostgresContentStore } from "./postgres-content-store.ts";

export function createPostgresContentPublication(
  database: PostgresDatabase,
): ContentPublicationService {
  return new ContentPublicationService(
    database,
    new PostgresContentStore(database),
    new PostgresCatalogProjection(database),
    new PostgresCatalogCompatibility(database),
    new PostgresWorldProjection(database),
    new ContentValidator(),
    new ContentActivationCompatibility(),
    new PostgresFarmStockProjection(database),
    new PostgresQuestProjection(database),
  );
}
