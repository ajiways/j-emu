import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { syncGearSetBonuses } from "./apply-gear-set-bonuses.ts";
import { consumeFromBag, countBagByArtifact } from "./consume-from-bag.ts";
import type { InventoryItem } from "./inventory-item.ts";

export type ConsumeByArtikulCommand = Readonly<{
  characterId: number;
  artifactId: number;
  quantity: number;
  allowPaperdoll: boolean;
}>;

export async function consumeByArtikul(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: ConsumeByArtikulCommand,
): Promise<void> {
  if (!Number.isInteger(command.quantity) || command.quantity < 1) {
    throw new Error("Artikul consume count must be a positive integer");
  }
  const items = [...(await inventory.lockForHero(command.characterId))];
  const bag = countBagByArtifact(items, command.characterId, command.artifactId);
  if (bag > 0) {
    await consumeFromBag(
      inventory,
      items,
      command.characterId,
      command.artifactId,
      Math.min(bag, command.quantity),
    );
    return;
  }
  if (!command.allowPaperdoll) return;
  const removed = await consumePaperdoll(
    inventory,
    items,
    command.characterId,
    command.artifactId,
    command.quantity,
  );
  if (removed) await syncGearSetBonuses(inventory, catalog, command.characterId);
}

async function consumePaperdoll(
  inventory: InventoryRepository,
  items: InventoryItem[],
  heroId: number,
  artifactId: number,
  count: number,
): Promise<boolean> {
  let remaining = count;
  const worn = items
    .filter(
      (item) =>
        item.heroId === heroId &&
        item.artifactId === artifactId &&
        (item.location.kind === "equipment" || item.location.kind === "tempeffect"),
    )
    .sort((left, right) => paperdollOrd(left) - paperdollOrd(right) || left.id - right.id);
  let changed = false;
  for (const item of worn) {
    if (remaining < 1) break;
    const take = item.location.kind === "tempeffect" ? 1 : Math.min(item.quantity, remaining);
    if (item.location.kind === "tempeffect" || item.quantity <= remaining) {
      remaining -= take;
      await inventory.delete(item);
      changed = true;
      continue;
    }
    await inventory.save(item.withQuantity(item.quantity - remaining));
    remaining = 0;
    changed = true;
  }
  return changed;
}

function paperdollOrd(item: InventoryItem): number {
  return item.location.kind === "equipment" ? 0 : 1;
}
