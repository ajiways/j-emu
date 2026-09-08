import type { ArtifactUseAction } from "../../catalog/domain/artifact-use-action.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { addHpGain } from "./add-hp-gain.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { UseDeniedError } from "./use-denied-error.ts";

export type UseFromBagCommand = Readonly<{
  characterId: number;
  itemId: number;
  hpMax: number;
}>;

export type UseFromBagResult = Readonly<{
  gain: number;
}>;

export async function useFromBag(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: UseFromBagCommand,
): Promise<UseFromBagResult> {
  const items = await inventory.lockForHero(command.characterId);
  const item = requireBagItem(items, command.characterId, command.itemId);
  const definition = await catalog.artifact(item.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
  const action = definition.useAction;
  if (!action) throw UseDeniedError.withoutAction();
  if (action.code !== "ADD_HP") throw UseDeniedError.unsupported(action.code);
  const gain = addHpGain(command.hpMax, action.param1, action.param2);
  if (gain < 1) throw UseDeniedError.invalidEffect();
  await consumeDispose(inventory, item, action);
  return { gain };
}

function requireBagItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item || item.heroId !== heroId) throw UseDeniedError.itemMissing();
  if (item.location.kind !== "bag") throw UseDeniedError.mustUnequip();
  return item;
}

async function consumeDispose(
  inventory: InventoryRepository,
  item: InventoryItem,
  action: ArtifactUseAction,
): Promise<void> {
  if (action.dispose === 0) return;
  if (item.quantity <= 1) await inventory.delete(item);
  else await inventory.save(item.withQuantity(item.quantity - 1));
}
