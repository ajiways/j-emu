import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import { locationAreaBlocks } from "./location-area-read.ts";
import { buildHeroState } from "./hero-state-block.ts";
import type { UserSkillsBlock } from "./user-skills-block.ts";
import type { UserUnitframeBlock } from "./user-unitframe-block.ts";

export async function buildTravelMutation(input: {
  accountId: number;
  actionKey: "common|action" | "common|exit";
  actionBlock: object;
  characters: CharacterService;
  catalog: Catalog;
  world: WorldService;
  areaPopulation: object;
  unitframe: UserUnitframeBlock;
  skills: UserSkillsBlock;
  clock: Clock;
}): Promise<Readonly<Record<string, unknown>>> {
  const hero = await input.characters.getByAccountId(input.accountId);
  if (!hero) throw new Error(`Hero for account ${input.accountId} is missing`);
  const location = await locationAreaBlocks(input.world, input.catalog, hero, input.clock);
  return {
    [input.actionKey]: input.actionBlock,
    "common|area_conf": location.areaConf,
    "common|hunt": location.hunt,
    state: buildHeroState(hero, input.clock),
    "user|unitframe": input.unitframe,
    "user|skills": input.skills,
    "chat|area_population": input.areaPopulation,
  };
}
