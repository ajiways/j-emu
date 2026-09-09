import type { Catalog } from "../../catalog/ports/catalog.ts";
import { applyRepair, canRepair, instanceDurability, repairCostGold } from "./durability.ts";
import { RepairDeniedError } from "./repair-denied-error.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";

export type RepairItemCommand = Readonly<{
  characterId: number;
  itemId: number;
}>;

export type RepairItemResult = Readonly<{
  costMinor: number;
}>;

export async function repairItem(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: RepairItemCommand,
): Promise<RepairItemResult> {
  if (!Number.isInteger(command.itemId) || command.itemId < 1) throw new RepairDeniedError();
  const items = await inventory.lockForHero(command.characterId);
  const matches = items.filter((item) => item.id === command.itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${command.itemId}`);
  const item = matches[0];
  if (!item || item.heroId !== command.characterId) throw new RepairDeniedError();
  const definition = await catalog.artifact(item.artifactId);
  if (!definition) throw new RepairDeniedError();
  const before = instanceDurability(item.durability, item.durabilityMax, definition.flags);
  if (!canRepair(before)) throw new RepairDeniedError();
  const costMinor = Math.round(repairCostGold(definition.priceMinor / 100) * 100);
  const after = applyRepair(before.current, before.max, before.infinite);
  await inventory.save(item.withDurability(after.current, after.max));
  return { costMinor };
}
