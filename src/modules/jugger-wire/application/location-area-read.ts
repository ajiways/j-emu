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
import { areaActionConfItem, areaLinkToConfItem, npcConfItem } from "./area-conf-item-wire.ts";
import { buildHuntBlock, type HuntBlock } from "./hunt-block.ts";
import type { InstanceHuntWorld } from "../../instance/ports/instance-hunt.ts";
import type { QuestCatalog } from "../../quests/ports/quest-catalog.ts";

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
  quests: QuestCatalog,
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
  const items = [
    ...(await world.linksFrom(area.id)).map(areaLinkToConfItem),
    ...(await quests.npcsInArea(area.id)).map((npc) =>
      npcConfItem({
        id: npc.itemId,
        title: npc.title,
        picture: npc.picture,
        description: npc.description,
        npcId: npc.id,
      }),
    ),
    ...(await quests.areaHotspots(area.id)).map((hotspot) =>
      areaActionConfItem({
        id: hotspot.objectId,
        title: hotspot.title,
        picture: "",
        description: hotspot.waitingPopup || hotspot.title,
        actionId: hotspot.actionId,
      }),
    ),
  ];
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
