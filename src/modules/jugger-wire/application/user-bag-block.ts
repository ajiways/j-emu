import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { isPaperdollSlotMask } from "../../inventory/domain/paperdoll-slot.ts";
import { FLAG_PUT_ON } from "./item-action-flags.ts";

type BagItemBlock = Readonly<{
  id: number;
  artikul_id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  slot_mask: number;
  cnt: number;
  action: "bag";
  actions: number;
}>;

export type UserBagBlock = Readonly<{
  status: 100;
  bag: Readonly<Record<string, BagItemBlock>>;
  amount: number;
  amount_max: number;
}>;

export type UserPocketBlock = Readonly<{
  status: 100;
  capacity: number;
  pocket: readonly [];
}>;

export async function buildUserBag(
  hero: Hero,
  inventory: InventoryService,
  catalog: Catalog,
  bagCapacity: number,
): Promise<UserBagBlock> {
  if (bagCapacity < 1) throw new Error("Bag capacity must be positive");
  const items = await inventory.list(hero.id);
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
      slot_mask: definition.slotMask,
      cnt: item.quantity,
      action: "bag",
      actions: isPaperdollSlotMask(definition.slotMask) ? FLAG_PUT_ON : 0,
    };
  }
  return {
    status: 100,
    bag,
    amount: Object.keys(bag).length,
    amount_max: bagCapacity,
  };
}

export function buildUserPocket(pocketCapacity: number): UserPocketBlock {
  if (pocketCapacity < 1) throw new Error("Pocket capacity must be positive");
  return { status: 100, capacity: pocketCapacity, pocket: [] };
}
