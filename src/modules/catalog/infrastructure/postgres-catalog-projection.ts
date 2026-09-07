import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ArtifactDocument, BotDocument } from "../../content/domain/content-document.ts";
import type { CatalogProjection } from "../ports/catalog-projection.ts";
import { artifacts, bots } from "./schema.ts";

export class PostgresCatalogProjection implements CatalogProjection {
  constructor(private readonly database: PostgresDatabase) {}

  async materialize(
    releaseId: string,
    artifactDocuments: readonly ArtifactDocument[],
    botDocuments: readonly BotDocument[],
  ): Promise<void> {
    const session = this.database.session();
    if (artifactDocuments.length > 0) {
      await session.insert(artifacts).values(
        artifactDocuments.map((artifact) => ({
          releaseId,
          id: artifact.id,
          title: artifact.title,
          picture: artifact.picture,
          typeId: artifact.typeId,
          kindId: artifact.kindId,
          slotMask: artifact.slotMask,
          weight: artifact.weight,
        })),
      );
    }
    if (botDocuments.length > 0) {
      await session.insert(bots).values(
        botDocuments.map((bot) => ({
          releaseId,
          id: bot.id,
          title: bot.title,
          level: bot.level,
          maxHp: bot.maxHp,
          strength: bot.strength,
        })),
      );
    }
  }
}
