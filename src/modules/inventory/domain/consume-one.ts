import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { requireHeroItem } from "./inventory-item-lookup.ts";

/** Spends one piece of a stack the hero keeps at `kind` (the pocket or the bag), e.g. after a fight cast. */
export async function consumeOne(
  repository: InventoryRepository,
  command: Readonly<{ characterId: number; itemId: number }>,
  kind: "pocket" | "bag",
): Promise<void> {
  const items = await repository.lockForHero(command.characterId);
  const item = requireHeroItem(items, command.characterId, command.itemId);
  if (item.location.kind !== kind) throw new Error(`Item ${command.itemId} is not in the ${kind}`);
  if (item.quantity <= 1) await repository.delete(item);
  else await repository.save(item.withQuantity(item.quantity - 1));
}
