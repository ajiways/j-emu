import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import { Area } from "../domain/area.ts";
import { HuntSpawn } from "../domain/hunt-spawn.ts";
import type { WorldRepository } from "../ports/world-repository.ts";
import { areas, huntSpawns } from "./schema.ts";

export class PostgresWorldRepository implements WorldRepository {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async findArea(id: string): Promise<Area | null> {
    const releaseId = await this.revision.requireId();
    const found = await this.database
      .session()
      .select()
      .from(areas)
      .where(and(eq(areas.releaseId, releaseId), eq(areas.id, id)));
    if (found.length > 1) throw new Error(`Multiple areas found for ${id}`);
    const area = found[0];
    if (!area) return null;
    const spawns = await this.database
      .session()
      .select()
      .from(huntSpawns)
      .where(and(eq(huntSpawns.releaseId, releaseId), eq(huntSpawns.areaId, id)))
      .orderBy(asc(huntSpawns.id));
    return new Area(
      area.id,
      area.title,
      area.mapAsset,
      area.fightBackground,
      area.regionMap,
      area.ftimeMax,
      area.code,
      area.context,
      area.soundIntro,
      area.soundBg,
      area.instArtikulId,
      area.haveTradeChannel,
      area.haveKindChannel,
      area.hideFinishedFights,
      area.hideRunningFights,
      area.noClanChat,
      spawns.map(
        (spawn) =>
          new HuntSpawn(spawn.id, spawn.botId, spawn.positionX, spawn.positionY, spawn.huntMask),
      ),
    );
  }
}
