import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { PostgresCatalogProjection } from "../../catalog/infrastructure/postgres-catalog-projection.ts";
import { PostgresCatalogCompatibility } from "../../catalog/infrastructure/postgres-catalog-compatibility.ts";
import { PostgresWorldProjection } from "../../world/infrastructure/postgres-world-projection.ts";
import { PostgresFarmStockProjection } from "../../professions/infrastructure/postgres-farm-stock-projection.ts";
import { PostgresQuestProjection } from "../../quests/infrastructure/postgres-quest-projection.ts";
import { ContentEditorService } from "../application/content-editor-service.ts";
import { ContentPublicationService } from "../application/content-publication-service.ts";
import { ContentActivationCompatibility } from "../application/content-activation-compatibility.ts";
import { ContentMaterializer } from "../application/content-materializer.ts";
import { ContentValidator } from "../application/content-validator.ts";
import { PostgresContentEditorStore } from "./postgres-content-editor-store.ts";
import { PostgresContentStore } from "./postgres-content-store.ts";

function createContentMaterializer(database: PostgresDatabase): ContentMaterializer {
  return new ContentMaterializer(
    new PostgresCatalogProjection(database),
    new PostgresWorldProjection(database),
    new PostgresFarmStockProjection(database),
    new PostgresQuestProjection(database),
  );
}

export function createPostgresContentPublication(
  database: PostgresDatabase,
): ContentPublicationService {
  return new ContentPublicationService(
    database,
    new PostgresContentStore(database),
    new PostgresCatalogCompatibility(database),
    new ContentValidator(),
    new ContentActivationCompatibility(),
    createContentMaterializer(database),
  );
}

export function createPostgresContentEditor(database: PostgresDatabase): ContentEditorService {
  return new ContentEditorService(
    database,
    new PostgresContentStore(database),
    new PostgresContentEditorStore(database),
    new ContentValidator(),
    new ContentActivationCompatibility(),
    new PostgresCatalogCompatibility(database),
    createContentMaterializer(database),
  );
}
