import type { Area } from "../domain/area.ts";
import type { AreaLink } from "../domain/area-link.ts";
import type { HuntSpawn } from "../domain/hunt-spawn.ts";

export type HuntSpawnRecord = Readonly<{
  areaId: string;
  spawn: HuntSpawn;
}>;

export interface WorldRepository {
  findArea(id: string): Promise<Area | null>;
  listHuntSpawns(): Promise<readonly HuntSpawnRecord[]>;
  listLinksFrom(areaId: string): Promise<readonly AreaLink[]>;
  findLink(fromAreaId: string, toAreaId: string): Promise<AreaLink | null>;
}
