import type {
  DungeonClearCoins,
  DungeonDefinition,
  DungeonSpawnDefinition,
} from "../../catalog/domain/dungeon-definition.ts";

export function progressFinish(dungeon: DungeonDefinition): number {
  if (!dungeon.hasClear) return 0;
  const finish = dungeon.progressFinishValue;
  if (finish === null || !Number.isInteger(finish) || finish < 1) {
    throw new Error(`Dungeon ${dungeon.artikulId} progress_finish_value is required`);
  }
  return finish;
}

export function clearProgress(dungeon: DungeonDefinition, killedKeys: ReadonlySet<string>): number {
  if (!dungeon.hasClear) return 0;
  const finish = progressFinish(dungeon);
  let killed = 0;
  for (const area of dungeon.areas) {
    for (const spawn of area.spawns) {
      if (spawn.countsForClear && killedKeys.has(spawn.spawnKey)) killed += 1;
    }
  }
  return Math.min(killed, finish);
}

export function clearCoinTotal(progress: number, coins: DungeonClearCoins, finish: number): number {
  if (!Number.isInteger(progress) || progress < 0) {
    throw new Error("Clear progress is invalid");
  }
  if (!Number.isInteger(finish) || finish < 1) {
    throw new Error("Clear finish is invalid");
  }
  if (
    !Number.isInteger(coins.coinArtikulId) ||
    coins.coinArtikulId < 1 ||
    !Number.isInteger(coins.coinMin) ||
    coins.coinMin < 1 ||
    !Number.isInteger(coins.coinMax) ||
    coins.coinMax < coins.coinMin
  ) {
    throw new Error("Clear coin trio is invalid");
  }
  if (progress === 0) return 0;
  const capped = Math.min(progress, finish);
  const raw = Math.round((coins.coinMax * capped) / finish);
  return Math.min(coins.coinMax, Math.max(coins.coinMin, raw));
}

export function dungeonSpawn(dungeon: DungeonDefinition, spawnKey: string): DungeonSpawnDefinition {
  if (!spawnKey) throw new Error("Dungeon spawn key is required");
  for (const area of dungeon.areas) {
    for (const spawn of area.spawns) {
      if (spawn.spawnKey === spawnKey) return spawn;
    }
  }
  throw new Error(`Dungeon ${dungeon.artikulId} spawn ${spawnKey} is missing`);
}

export function spawnIsBoss(
  spawn: DungeonSpawnDefinition,
  dungeon: DungeonDefinition,
  huntBotId: number,
): boolean {
  if (spawn.isBoss) return true;
  return dungeon.loot.bossBotId !== null && dungeon.loot.bossBotId === huntBotId;
}

export function dungeonLootExcludeIds(dungeon: DungeonDefinition): ReadonlySet<number> {
  const ids = new Set<number>(dungeon.loot.personalGuaranteed);
  if (dungeon.clear) ids.add(dungeon.clear.coinArtikulId);
  return ids;
}
