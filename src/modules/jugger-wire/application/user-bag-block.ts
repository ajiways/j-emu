import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import { bagActionsFor } from "../../inventory/domain/bag-actions.ts";
import { noweightWire } from "../../inventory/domain/artifact-flags.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { sellPriceMinor } from "../../inventory/domain/sell-price.ts";
import { artifactSkillWireMap, type ArtifactSkillWireBlock } from "./artifact-skill-wire.ts";
import { moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";

type BagItemBlock = Readonly<{
  id: number;
  artikul_id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  slot: 0;
  slot2: 0;
  slot_num: 0;
  slot_mask: number;
  level_min: number;
  level_max: number;
  cnt: number;
  action: "bag";
  actions: number;
  flags: number;
  noweight: 0 | 1;
  price: number;
  sell_price: number;
  artifact_skills: Readonly<Record<string, ArtifactSkillWireBlock>>;
  artifact_actions: Readonly<Record<string, never>>;
}>;

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
    bag[String(item.id)] = {
      id: item.id,
      artikul_id: definition.id,
      title: definition.title,
      picture: definition.picture,
      type_id: definition.typeId,
      kind_id: definition.kindId,
      slot: 0,
      slot2: 0,
      slot_num: 0,
      slot_mask: definition.slotMask,
      level_min: definition.levelMin,
      level_max: definition.levelMax,
      cnt: item.quantity,
      action: "bag",
      actions: bagActionsFor(definition.slotMask),
      flags: definition.flags,
      noweight: noweightWire(definition.flags),
      price: moneyNumberFromMinorUnits(definition.priceMinor),
      sell_price: moneyNumberFromMinorUnits(sellPriceMinor(definition.priceMinor)),
      artifact_skills: await artifactSkillWireMap(definition.skills, catalog),
      artifact_actions: {},
    };
  }
  return {
    status: 100,
    bag,
    amount: load.amount,
    total: load.total,
    amount_max: load.amountMax,
  };
}
