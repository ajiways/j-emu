import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { buildBagItemBlock, type BagItemBlock } from "./bag-item-block.ts";

export type UserBagBlock = Readonly<{
  status: 100;
  bag: Readonly<Record<string, BagItemBlock>>;
  amount: number;
  total: number;
  amount_max: number;
}>;

export async function buildUserBag(
  hero: Hero,
  inventory: InventoryService,
  catalog: Catalog,
): Promise<UserBagBlock> {
  const items = await inventory.list(hero.id);
  const load = await inventory.bagLoad({ characterId: hero.id });
  const bag: Record<string, BagItemBlock> = {};
  for (const item of items) {
    if (item.location.kind !== "bag") continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    bag[String(item.id)] = await buildBagItemBlock(definition, item, catalog);
  }
  return {
    status: 100,
    bag,
    amount: load.amount,
    total: load.total,
    amount_max: load.amountMax,
  };
}
