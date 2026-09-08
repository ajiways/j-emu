import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { buildHeroState } from "./hero-state-block.ts";
import { buildUserBag } from "./user-bag-block.ts";
import { buildUserPocket } from "./user-pocket-block.ts";
import type { UserSkillsBlock } from "./user-skills-block.ts";
import type { UserUnitframeBlock } from "./user-unitframe-block.ts";

export async function buildUseMutation(input: {
  hero: Hero;
  inventory: InventoryService;
  catalog: Catalog;
  pocketCapacity: number;
  unitframe: UserUnitframeBlock;
  skills: UserSkillsBlock;
  clock: Clock;
}): Promise<Readonly<Record<string, unknown>>> {
  return {
    "common|action": { status: 100, action: "USE" },
    "user|bag": await buildUserBag(input.hero, input.inventory, input.catalog),
    "user|pocket": await buildUserPocket(
      input.inventory,
      input.catalog,
      input.hero.id,
      input.pocketCapacity,
    ),
    "user|unitframe": input.unitframe,
    "user|skills": input.skills,
    state: buildHeroState(input.hero, input.clock),
  };
}
