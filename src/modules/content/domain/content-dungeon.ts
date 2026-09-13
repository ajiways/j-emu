type DungeonEncounterDocument = Readonly<{
  botId: number;
  count: number;
}>;

type DungeonRouteStopDocument = Readonly<{
  x: number;
  y: number;
  waitMin: number;
  waitMax: number;
}>;

type DungeonZonePointDocument = Readonly<{
  x: number;
  y: number;
}>;

type DungeonSpawnDocument = Readonly<{
  spawnKey: string;
  huntBotId: number;
  encounter: readonly DungeonEncounterDocument[];
  isBoss: boolean;
  countsForClear: boolean;
  huntMask: string;
  positionX: number;
  positionY: number;
  waitMin: number;
  waitMax: number;
  zone: readonly DungeonZonePointDocument[];
  route: readonly DungeonRouteStopDocument[];
}>;

type DungeonAreaDocument = Readonly<{
  areaId: string;
  spawns: readonly DungeonSpawnDocument[];
}>;

type DungeonClearDocument = Readonly<{
  coinArtikulId: number;
  coinMin: number;
  coinMax: number;
}>;

type DungeonLootDocument = Readonly<{
  bossBotId?: number;
  personalGuaranteed: readonly number[];
}>;

export type DungeonDocument = Readonly<{
  artikulId: number;
  title: string;
  startAreaId: string;
  parentAreaId: string;
  levelMin: number;
  durationSec: number;
  imgUrl: string;
  hasClear: boolean;
  progressFinishValue?: number;
  clear?: DungeonClearDocument;
  loot?: DungeonLootDocument;
  areas: readonly DungeonAreaDocument[];
}>;
