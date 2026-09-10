import type { DungeonDocument } from "../../content/domain/content-dungeon.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import {
  dungeonAreas,
  dungeonSpawnEncounters,
  dungeonSpawnRoutes,
  dungeonSpawns,
  dungeons,
} from "./schema-dungeons.ts";

export async function insertDungeons(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly DungeonDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(dungeons).values(
    rows.map((dungeon) => ({
      releaseId,
      artikulId: dungeon.artikulId,
      title: dungeon.title,
      startAreaId: dungeon.startAreaId,
      parentAreaId: dungeon.parentAreaId,
      levelMin: dungeon.levelMin,
      durationSec: dungeon.durationSec,
      imgUrl: dungeon.imgUrl,
      hasClear: dungeon.hasClear ? 1 : 0,
    })),
  );
  await session.insert(dungeonAreas).values(
    rows.flatMap((dungeon) =>
      dungeon.areas.map((area) => ({
        releaseId,
        artikulId: dungeon.artikulId,
        areaId: area.areaId,
      })),
    ),
  );
  const spawnRows = rows.flatMap((dungeon) =>
    dungeon.areas.flatMap((area) =>
      area.spawns.map((spawn) => ({
        releaseId,
        artikulId: dungeon.artikulId,
        areaId: area.areaId,
        spawnKey: spawn.spawnKey,
        huntBotId: spawn.huntBotId,
        isBoss: spawn.isBoss ? 1 : 0,
        countsForClear: spawn.countsForClear ? 1 : 0,
        huntMask: spawn.huntMask,
        positionX: spawn.positionX,
        positionY: spawn.positionY,
        waitMin: spawn.waitMin,
        waitMax: spawn.waitMax,
      })),
    ),
  );
  await session.insert(dungeonSpawns).values(spawnRows);
  const encounterRows = rows.flatMap((dungeon) =>
    dungeon.areas.flatMap((area) =>
      area.spawns.flatMap((spawn) =>
        spawn.encounter.map((entry) => ({
          releaseId,
          artikulId: dungeon.artikulId,
          areaId: area.areaId,
          spawnKey: spawn.spawnKey,
          botId: entry.botId,
          count: entry.count,
        })),
      ),
    ),
  );
  if (encounterRows.length > 0) await session.insert(dungeonSpawnEncounters).values(encounterRows);
  const routeRows = rows.flatMap((dungeon) =>
    dungeon.areas.flatMap((area) =>
      area.spawns.flatMap((spawn) =>
        spawn.route.map((stop, ord) => ({
          releaseId,
          artikulId: dungeon.artikulId,
          areaId: area.areaId,
          spawnKey: spawn.spawnKey,
          ord,
          x: stop.x,
          y: stop.y,
          waitMin: stop.waitMin,
          waitMax: stop.waitMax,
        })),
      ),
    ),
  );
  if (routeRows.length > 0) await session.insert(dungeonSpawnRoutes).values(routeRows);
}
