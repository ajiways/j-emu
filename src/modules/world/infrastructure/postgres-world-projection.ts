import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { AreaDocument, HuntSpawnDocument } from "../../content/domain/content-document.ts";
import type { WorldProjection } from "../ports/world-projection.ts";
import { areas, huntSpawns } from "./schema.ts";

export class PostgresWorldProjection implements WorldProjection {
  constructor(private readonly database: PostgresDatabase) {}

  async materialize(
    releaseId: string,
    areaDocuments: readonly AreaDocument[],
    spawnDocuments: readonly HuntSpawnDocument[],
  ): Promise<void> {
    const session = this.database.session();
    if (areaDocuments.length > 0) {
      await session.insert(areas).values(
        areaDocuments.map((area) => ({
          releaseId,
          id: area.id,
          title: area.title,
          mapAsset: area.map,
          fightBackground: area.fightBackground,
        })),
      );
    }
    if (spawnDocuments.length > 0) {
      await session.insert(huntSpawns).values(
        spawnDocuments.map((spawn) => ({
          releaseId,
          id: spawn.id,
          areaId: spawn.areaId,
          botId: spawn.botId,
          positionX: spawn.x,
          positionY: spawn.y,
        })),
      );
    }
  }
}
