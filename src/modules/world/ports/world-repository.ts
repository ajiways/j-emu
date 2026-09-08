import type { Area } from "../domain/area.ts";
import type { AreaLink } from "../domain/area-link.ts";

export interface WorldRepository {
  findArea(id: string): Promise<Area | null>;
  listLinksFrom(areaId: string): Promise<readonly AreaLink[]>;
  findLink(fromAreaId: string, toAreaId: string): Promise<AreaLink | null>;
}
