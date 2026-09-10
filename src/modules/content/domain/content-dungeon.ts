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
  route: readonly DungeonRouteStopDocument[];
}>;

type DungeonAreaDocument = Readonly<{
  areaId: string;
  spawns: readonly DungeonSpawnDocument[];
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
  areas: readonly DungeonAreaDocument[];
}>;
