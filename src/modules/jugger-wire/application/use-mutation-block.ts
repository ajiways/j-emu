import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { buildUserBag } from "./user-bag-block.ts";
import { buildUserPocket } from "./user-pocket-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";
import type { UserSkillsBlock } from "./user-skills-block.ts";
import type { UserUnitframeBlock } from "./user-unitframe-block.ts";
import type { UserViewBlock } from "./user-view-block.ts";

export async function buildUseMutation(
  input: {
    hero: Hero;
    inventory: InventoryService;
    catalog: Catalog;
    pocketCapacity: number;
    unitframe: UserUnitframeBlock;
    skills: UserSkillsBlock;
    state: HeroStateBlock;
    msgText: string | null;
  } & ({ includeView: false } | { includeView: true; view: UserViewBlock }),
): Promise<Readonly<Record<string, unknown>>> {
  return {
    "common|action": {
      status: 100,
      action: "USE",
      ...(input.msgText === null ? {} : { msg_text: input.msgText }),
    },
    "user|bag": await buildUserBag(input.hero, input.inventory, input.catalog),
    "user|pocket": await buildUserPocket(
      input.inventory,
      input.catalog,
      input.hero.id,
      input.pocketCapacity,
    ),
    "user|unitframe": input.unitframe,
    "user|skills": input.skills,
    ...(input.includeView ? { "user|view": input.view } : {}),
    state: input.state,
  };
}
