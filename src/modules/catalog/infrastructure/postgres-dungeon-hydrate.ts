import type { DungeonDefinition, DungeonSpawnDefinition } from "../domain/dungeon-definition.ts";

export function hydrateClear(row: {
  artikulId: number;
  coinArtikulId: number | null;
  coinMin: number | null;
  coinMax: number | null;
}): DungeonDefinition["clear"] {
  const missing = row.coinArtikulId === null && row.coinMin === null && row.coinMax === null;
  if (missing) return null;
  if (row.coinArtikulId === null || row.coinMin === null || row.coinMax === null) {
    throw new Error(`Dungeon ${row.artikulId} clear coin trio is incomplete`);
  }
  return {
    coinArtikulId: row.coinArtikulId,
    coinMin: row.coinMin,
    coinMax: row.coinMax,
  };
}

export function spawnFromRow(
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
