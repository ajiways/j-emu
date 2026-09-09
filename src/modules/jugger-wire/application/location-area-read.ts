import type { BotDefinition } from "../../catalog/domain/bot-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import { remainingAreaFtime } from "../../world/domain/travel-ftime.ts";
import {
  buildLocationAreaConf,
  huntBotsForArea,
  type LocationAreaConfBlock,
} from "./area-conf-block.ts";
import { areaLinkToConfItem } from "./area-conf-item-wire.ts";
import { buildHuntBlock, type HuntBlock } from "./hunt-block.ts";

export type LocationAreaBlocks = Readonly<{
  areaConf: LocationAreaConfBlock;
  hunt: HuntBlock;
}>;

export async function locationAreaBlocks(
  world: WorldService,
  catalog: Catalog,
  hero: Hero,
  clock: Clock,
): Promise<LocationAreaBlocks> {
  const area = await world.area(hero.areaId);
  const bots = new Map<number, BotDefinition>();
  for (const spawn of area.spawns) {
    const definition = await catalog.bot(spawn.botId);
    if (!definition) throw new Error(`Bot catalog entry ${spawn.botId} is missing`);
    bots.set(definition.id, definition);
  }
  const items = (await world.linksFrom(area.id)).map(areaLinkToConfItem);
  return {
    areaConf: buildLocationAreaConf(
      area,
      huntBotsForArea(area.spawns, bots),
      items,
      remainingAreaFtime(hero.moveReadyAt, clock.now()),
    ),
    hunt: buildHuntBlock(await world.huntSnapshot(area.id)),
  };
}
