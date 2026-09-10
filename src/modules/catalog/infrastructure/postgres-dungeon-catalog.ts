import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import type {
  DungeonAreaDefinition,
  DungeonDefinition,
  DungeonSpawnDefinition,
} from "../domain/dungeon-definition.ts";
import type { DungeonCatalog } from "../ports/dungeon-catalog.ts";
import {
  dungeonAreas,
  dungeonSpawnEncounters,
  dungeonSpawnRoutes,
  dungeonSpawnZones,
  dungeonSpawns,
  dungeons,
} from "./schema-dungeons.ts";

export class PostgresDungeonCatalog implements DungeonCatalog {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async byArtikul(artikulId: string): Promise<DungeonDefinition | null> {
    const parsed = Number(artikulId);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error("Dungeon artikul id is required");
    }
    return this.load((table) => eq(table.artikulId, parsed));
  }

  async byStartArea(areaId: string): Promise<DungeonDefinition | null> {
    if (!areaId) throw new Error("Dungeon start area is required");
    return this.load((table) => eq(table.startAreaId, areaId));
  }

  async byArea(areaId: string): Promise<DungeonDefinition | null> {
    if (!areaId) throw new Error("Dungeon area is required");
    const releaseId = await this.revision.requireId();
    const areaRows = await this.database
      .session()
      .select({ artikulId: dungeonAreas.artikulId })
      .from(dungeonAreas)
      .where(and(eq(dungeonAreas.releaseId, releaseId), eq(dungeonAreas.areaId, areaId)));
    if (areaRows.length > 1) {
      throw new Error(`Multiple dungeons found for area ${areaId}`);
    }
    const row = areaRows[0];
    if (!row) return null;
    return this.byArtikul(String(row.artikulId));
  }

  private async load(
    where: (table: typeof dungeons) => ReturnType<typeof eq>,
  ): Promise<DungeonDefinition | null> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(dungeons)
      .where(and(eq(dungeons.releaseId, releaseId), where(dungeons)));
    if (rows.length > 1) throw new Error("Multiple dungeon definitions found");
    const row = rows[0];
    if (!row) return null;
    return this.hydrate(releaseId, row);
  }

  private async hydrate(
    releaseId: string,
    row: {
      artikulId: number;
      title: string;
      startAreaId: string;
      parentAreaId: string;
      levelMin: number;
      durationSec: number;
      imgUrl: string;
      hasClear: number;
    },
  ): Promise<DungeonDefinition> {
    const areaRows = await this.database
      .session()
      .select()
      .from(dungeonAreas)
      .where(and(eq(dungeonAreas.releaseId, releaseId), eq(dungeonAreas.artikulId, row.artikulId)));
    const spawnRows = await this.database
      .session()
      .select()
      .from(dungeonSpawns)
      .where(
        and(eq(dungeonSpawns.releaseId, releaseId), eq(dungeonSpawns.artikulId, row.artikulId)),
      );
    const encounterRows = await this.database
      .session()
      .select()
      .from(dungeonSpawnEncounters)
      .where(
        and(
          eq(dungeonSpawnEncounters.releaseId, releaseId),
          eq(dungeonSpawnEncounters.artikulId, row.artikulId),
        ),
      );
    const routeRows = await this.database
      .session()
      .select()
      .from(dungeonSpawnRoutes)
      .where(
        and(
          eq(dungeonSpawnRoutes.releaseId, releaseId),
          eq(dungeonSpawnRoutes.artikulId, row.artikulId),
        ),
      );
    const zoneRows = await this.database
      .session()
      .select()
      .from(dungeonSpawnZones)
      .where(
        and(
          eq(dungeonSpawnZones.releaseId, releaseId),
          eq(dungeonSpawnZones.artikulId, row.artikulId),
        ),
      );
    const areas: DungeonAreaDefinition[] = areaRows.map((area) => ({
      areaId: area.areaId,
      spawns: spawnRows
        .filter((spawn) => spawn.areaId === area.areaId)
        .map((spawn) => spawnFromRow(spawn, encounterRows, routeRows, zoneRows)),
    }));
    if (row.hasClear !== 0 && row.hasClear !== 1) {
      throw new Error(`Dungeon ${row.artikulId} has_clear is invalid`);
    }
    return {
      artikulId: String(row.artikulId),
      title: row.title,
      startAreaId: row.startAreaId,
      parentAreaId: row.parentAreaId,
      levelMin: row.levelMin,
      durationSec: row.durationSec,
      imgUrl: row.imgUrl,
      hasClear: row.hasClear === 1,
      areas,
    };
  }
}

function spawnFromRow(
  spawn: {
    areaId: string;
    spawnKey: string;
    huntBotId: number;
    isBoss: number;
    countsForClear: number;
    huntMask: string;
    positionX: number;
    positionY: number;
    waitMin: number;
    waitMax: number;
  },
  encounters: readonly {
    areaId: string;
    spawnKey: string;
    botId: number;
    count: number;
  }[],
  routes: readonly {
    areaId: string;
    spawnKey: string;
    ord: number;
    x: number;
    y: number;
    waitMin: number;
    waitMax: number;
  }[],
  zones: readonly {
    areaId: string;
    spawnKey: string;
    ord: number;
    x: number;
    y: number;
  }[],
): DungeonSpawnDefinition {
  const encounter = encounters
    .filter((entry) => entry.areaId === spawn.areaId && entry.spawnKey === spawn.spawnKey)
    .map((entry) => ({ botId: entry.botId, count: entry.count }));
  if (encounter.length < 1) {
    throw new Error(`Dungeon spawn ${spawn.spawnKey} encounter is missing`);
  }
  return {
    spawnKey: spawn.spawnKey,
    huntBotId: spawn.huntBotId,
    encounter,
    isBoss: spawn.isBoss === 1,
    countsForClear: spawn.countsForClear === 1,
    huntMask: spawn.huntMask,
    positionX: spawn.positionX,
    positionY: spawn.positionY,
    waitMin: spawn.waitMin,
    waitMax: spawn.waitMax,
    zone: zones
      .filter((point) => point.areaId === spawn.areaId && point.spawnKey === spawn.spawnKey)
      .sort((left, right) => left.ord - right.ord)
      .map((point) => ({ x: point.x, y: point.y })),
    route: routes
      .filter((stop) => stop.areaId === spawn.areaId && stop.spawnKey === spawn.spawnKey)
      .sort((left, right) => left.ord - right.ord)
      .map((stop) => ({
        x: stop.x,
        y: stop.y,
        waitMin: stop.waitMin,
        waitMax: stop.waitMax,
      })),
  };
}
