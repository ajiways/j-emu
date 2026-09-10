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
import type { InstanceHuntWorld } from "../../instance/ports/instance-hunt.ts";

export type LocationAreaBlocks = Readonly<{
  areaConf: LocationAreaConfBlock;
  hunt: HuntBlock;
}>;

export async function locationAreaBlocks(
  world: WorldService,
  catalog: Catalog,
  hero: Hero,
  clock: Clock,
  instanceHunt: InstanceHuntWorld,
): Promise<LocationAreaBlocks> {
  const area = await world.area(hero.areaId);
  const dungeonSpawns =
    hero.instanceCopyId === null ? [] : await instanceHunt.liveSpawns(hero.instanceCopyId, area.id);
  const authoredSpawns = hero.instanceCopyId === null ? area.spawns : dungeonSpawns;
  const bots = new Map<number, BotDefinition>();
  for (const spawn of authoredSpawns) {
    const definition = await catalog.bot(spawn.botId);
    if (!definition) throw new Error(`Bot catalog entry ${spawn.botId} is missing`);
    bots.set(definition.id, definition);
  }
  const items = (await world.linksFrom(area.id)).map(areaLinkToConfItem);
  const huntSnapshot =
    hero.instanceCopyId === null
      ? await world.huntSnapshot(area.id)
      : await instanceHunt.snapshot(hero.instanceCopyId, area.id);
  return {
    areaConf: buildLocationAreaConf(
      area,
      huntBotsForArea(authoredSpawns, bots),
      items,
      remainingAreaFtime(hero.moveReadyAt, clock.now()),
    ),
    hunt: buildHuntBlock(huntSnapshot),
  };
}
