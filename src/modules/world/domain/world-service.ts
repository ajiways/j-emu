import type { Area } from "./area.ts";
import type { HuntSpawn } from "./hunt-spawn.ts";
import type { WorldRepository } from "../ports/world-repository.ts";

export class WorldService {
  constructor(private readonly world: WorldRepository) {}

  async area(id: string): Promise<Area> {
    const area = await this.world.findArea(id);
    if (!area) throw new Error(`Unknown area ${id}`);
    return area;
  }

  async spawn(areaId: string, spawnId: string): Promise<HuntSpawn | null> {
    const found = (await this.area(areaId)).spawns.find((spawn) => spawn.id === spawnId);
    if (!found) return null;
    return found;
  }
}
