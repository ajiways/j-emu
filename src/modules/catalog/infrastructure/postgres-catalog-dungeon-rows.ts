import type { DungeonDocument } from "../../content/domain/content-dungeon.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import {
  dungeonAreas,
  dungeonPersonalGuaranteed,
  dungeonSpawnEncounters,
  dungeonSpawnRoutes,
  dungeonSpawnZones,
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
      progressFinishValue:
        dungeon.progressFinishValue === undefined ? null : dungeon.progressFinishValue,
      coinArtikulId: dungeon.clear === undefined ? null : dungeon.clear.coinArtikulId,
      coinMin: dungeon.clear === undefined ? null : dungeon.clear.coinMin,
      coinMax: dungeon.clear === undefined ? null : dungeon.clear.coinMax,
      lootBossBotId:
        dungeon.loot === undefined || dungeon.loot.bossBotId === undefined
          ? null
          : dungeon.loot.bossBotId,
    })),
  );
  const personalRows = rows.flatMap((dungeon) => {
    if (dungeon.loot === undefined) return [];
    return dungeon.loot.personalGuaranteed.map((lootArtikulId) => ({
      releaseId,
      dungeonArtikulId: dungeon.artikulId,
      lootArtikulId,
    }));
  });
  if (personalRows.length > 0) {
    await session.insert(dungeonPersonalGuaranteed).values(personalRows);
  }
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
  const zoneRows = rows.flatMap((dungeon) =>
    dungeon.areas.flatMap((area) =>
      area.spawns.flatMap((spawn) =>
        spawn.zone.map((point, ord) => ({
          releaseId,
          artikulId: dungeon.artikulId,
          areaId: area.areaId,
          spawnKey: spawn.spawnKey,
          ord,
          x: point.x,
          y: point.y,
        })),
      ),
    ),
  );
  if (zoneRows.length > 0) await session.insert(dungeonSpawnZones).values(zoneRows);
}
