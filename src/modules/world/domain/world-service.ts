import type { Area } from "./area.ts";
import type { AreaLink } from "./area-link.ts";
import { MissingLinkError } from "./missing-link-error.ts";
import type { HuntSpawn } from "./hunt-spawn.ts";
import type { WorldRepository } from "../ports/world-repository.ts";

export class WorldService {
  constructor(private readonly world: WorldRepository) {}

  async area(id: string): Promise<Area> {
    const area = await this.world.findArea(id);
    if (!area) throw new Error(`Unknown area ${id}`);
    return area;
  }

  async linksFrom(areaId: string): Promise<readonly AreaLink[]> {
    if (!areaId) throw new Error("Area id is required");
    return this.world.listLinksFrom(areaId);
  }

  async requireLink(fromAreaId: string, toAreaId: string): Promise<AreaLink> {
    if (!fromAreaId) throw new Error("fromAreaId is required");
    if (!toAreaId) throw new Error("toAreaId is required");
    const link = await this.world.findLink(fromAreaId, toAreaId);
    if (!link) throw new MissingLinkError();
    return link;
  }

  async spawn(areaId: string, spawnId: number): Promise<HuntSpawn | null> {
    const found = (await this.area(areaId)).spawns.find((spawn) => spawn.id === spawnId);
    if (!found) return null;
    return found;
  }
}
