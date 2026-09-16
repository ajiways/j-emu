import type { Hero } from "../../character/domain/hero.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import { OUTDOOR_TEMPLE_AREA_ID } from "../../world/domain/outdoor-temple-area.ts";

export async function ghostResurrectZone(
  hero: Hero,
  world: WorldService,
): Promise<Readonly<{ id: string; title: string }>> {
  const areaId = hero.instanceCopyId === null ? OUTDOOR_TEMPLE_AREA_ID : hero.areaId;
  const area = await world.area(areaId);
  return { id: area.id, title: area.title };
}
