import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  AreaDocument,
  AreaLinkDocument,
  HuntSpawnDocument,
} from "../../content/domain/content-document.ts";
import type { WorldProjection } from "../ports/world-projection.ts";
import { areaLinks, areas, huntSpawns } from "./schema.ts";

export class PostgresWorldProjection implements WorldProjection {
  constructor(private readonly database: PostgresDatabase) {}

  async materialize(
    releaseId: string,
    areaDocuments: readonly AreaDocument[],
    linkDocuments: readonly AreaLinkDocument[],
    spawnDocuments: readonly HuntSpawnDocument[],
  ): Promise<void> {
    const session = this.database.session();
    if (areaDocuments.length > 0) {
      await session.insert(areas).values(
        areaDocuments.map((area) => ({
          releaseId,
          id: area.id,
          title: area.title,
          parentId: area.parentId,
          mapAsset: area.map,
          fightBackground: area.fightBackground,
          regionMap: area.regionMap,
          ftimeMax: area.ftimeMax,
          code: area.code,
          context: area.context,
          soundIntro: area.soundIntro,
          soundBg: area.soundBg,
          instArtikulId: area.instArtikulId,
          haveTradeChannel: area.haveTradeChannel,
          haveKindChannel: area.haveKindChannel,
          hideFinishedFights: area.hideFinishedFights,
          hideRunningFights: area.hideRunningFights,
          noClanChat: area.noClanChat,
        })),
      );
    }
    if (linkDocuments.length > 0) {
      await session.insert(areaLinks).values(
        linkDocuments.map((link) => ({
          releaseId,
          fromAreaId: link.fromAreaId,
          itemId: link.itemId,
          toAreaId: link.toAreaId,
          title: link.title,
          picture: link.picture,
          description: link.description,
          flags: link.flags,
          direction: link.direction,
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
          huntMask: spawn.huntMask,
        })),
      );
    }
  }
}
