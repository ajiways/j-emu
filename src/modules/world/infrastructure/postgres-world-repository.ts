import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { bots } from "../../catalog/infrastructure/schema.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import { Area } from "../domain/area.ts";
import { AreaLink } from "../domain/area-link.ts";
import { HuntSpawn } from "../domain/hunt-spawn.ts";
import type { HuntSpawnRecord, WorldRepository } from "../ports/world-repository.ts";
import { areaLinks, areas, huntSpawns } from "./schema.ts";

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
      .select(spawnColumns)
      .from(huntSpawns)
      .innerJoin(bots, and(eq(bots.releaseId, huntSpawns.releaseId), eq(bots.id, huntSpawns.botId)))
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
      area.parentId,
      area.context,
      area.soundIntro,
      area.soundBg,
      area.instArtikulId,
      area.haveTradeChannel,
      area.haveKindChannel,
      area.hideFinishedFights,
      area.hideRunningFights,
      area.noClanChat,
      spawns.map((row) => spawnFromRow(row)),
    );
  }

  async listHuntSpawns(): Promise<readonly HuntSpawnRecord[]> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select(spawnColumns)
      .from(huntSpawns)
      .innerJoin(bots, and(eq(bots.releaseId, huntSpawns.releaseId), eq(bots.id, huntSpawns.botId)))
      .where(eq(huntSpawns.releaseId, releaseId))
      .orderBy(asc(huntSpawns.areaId), asc(huntSpawns.id));
    return rows.map((row) => ({ areaId: row.areaId, spawn: spawnFromRow(row) }));
  }

  async listLinksFrom(areaId: string): Promise<readonly AreaLink[]> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(areaLinks)
      .where(and(eq(areaLinks.releaseId, releaseId), eq(areaLinks.fromAreaId, areaId)))
      .orderBy(asc(areaLinks.itemId));
    return rows.map(linkFromRow);
  }

  async findLink(fromAreaId: string, toAreaId: string): Promise<AreaLink | null> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(areaLinks)
      .where(
        and(
          eq(areaLinks.releaseId, releaseId),
          eq(areaLinks.fromAreaId, fromAreaId),
          eq(areaLinks.toAreaId, toAreaId),
        ),
      );
    if (rows.length > 1) {
      throw new Error(`Multiple area links found for ${fromAreaId} → ${toAreaId}`);
    }
    const row = rows[0];
    if (!row) return null;
    return linkFromRow(row);
  }
}

const spawnColumns = {
  id: huntSpawns.id,
  areaId: huntSpawns.areaId,
  botId: huntSpawns.botId,
  positionX: huntSpawns.positionX,
  positionY: huntSpawns.positionY,
  huntMask: huntSpawns.huntMask,
  waitMin: huntSpawns.waitMin,
  waitMax: huntSpawns.waitMax,
  respawnTimeMin: huntSpawns.respawnTimeMin,
  respawnTimeMax: huntSpawns.respawnTimeMax,
  zone: huntSpawns.zone,
  route: huntSpawns.route,
  huntSpeed: bots.huntSpeed,
} as const;

type SpawnRow = {
  id: number;
  areaId: string;
  botId: number;
  positionX: number;
  positionY: number;
  huntMask: string;
  waitMin: number;
  waitMax: number;
  respawnTimeMin: number;
  respawnTimeMax: number;
  zone: readonly { x: number; y: number }[];
  route: readonly { x: number; y: number; waitMin: number; waitMax: number }[];
  huntSpeed: number;
};

function spawnFromRow(row: SpawnRow): HuntSpawn {
  return new HuntSpawn(row.id, row.botId, row.positionX, row.positionY, row.huntMask, {
    huntSpeed: row.huntSpeed,
    waitMin: row.waitMin,
    waitMax: row.waitMax,
    respawnTimeMin: row.respawnTimeMin,
    respawnTimeMax: row.respawnTimeMax,
    zone: row.zone,
    route: row.route,
  });
}

function linkFromRow(row: {
  fromAreaId: string;
  itemId: number;
  toAreaId: string;
  title: string;
  picture: string;
  description: string;
  flags: number;
  direction: number;
}): AreaLink {
  return new AreaLink(
    row.fromAreaId,
    row.itemId,
    row.toAreaId,
    row.title,
    row.picture,
    row.description,
    row.flags,
    row.direction,
  );
}
