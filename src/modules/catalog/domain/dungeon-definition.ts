import type { HuntMaskPoint, HuntRouteStop } from "../../world/domain/hunt-spawn.ts";

type DungeonEncounter = Readonly<{
  botId: number;
  count: number;
}>;

export type DungeonSpawnDefinition = Readonly<{
  spawnKey: string;
  huntBotId: number;
  encounter: readonly DungeonEncounter[];
  isBoss: boolean;
  countsForClear: boolean;
  huntMask: string;
  positionX: number;
  positionY: number;
  waitMin: number;
  waitMax: number;
  zone: readonly HuntMaskPoint[];
  route: readonly HuntRouteStop[];
}>;

export type DungeonAreaDefinition = Readonly<{
  areaId: string;
  spawns: readonly DungeonSpawnDefinition[];
}>;

export type DungeonClearCoins = Readonly<{
  coinArtikulId: number;
  coinMin: number;
  coinMax: number;
}>;

type DungeonLootDefinition = Readonly<{
  bossBotId: number | null;
  personalGuaranteed: readonly number[];
}>;

export type DungeonDefinition = Readonly<{
  artikulId: string;
  title: string;
  startAreaId: string;
  parentAreaId: string;
  levelMin: number;
  durationSec: number;
  imgUrl: string;
  hasClear: boolean;
  progressFinishValue: number | null;
  clear: DungeonClearCoins | null;
  loot: DungeonLootDefinition;
  areas: readonly DungeonAreaDefinition[];
}>;

export function dungeonArea(
  dungeon: DungeonDefinition,
  areaId: string,
): DungeonAreaDefinition | null {
  return dungeon.areas.find((area) => area.areaId === areaId) ?? null;
}

export function dungeonContainsArea(dungeon: DungeonDefinition, areaId: string): boolean {
  return dungeonArea(dungeon, areaId) !== null;
}
