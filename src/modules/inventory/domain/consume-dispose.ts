import type { ArtifactUseAction } from "../../catalog/domain/artifact-use-action.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import type { InventoryItem } from "./inventory-item.ts";

export async function consumeDispose(
  inventory: InventoryRepository,
  item: InventoryItem,
  action: ArtifactUseAction,
): Promise<void> {
  if (action.dispose === 0) return;
  if (item.quantity <= 1) await inventory.delete(item);
  else await inventory.save(item.withQuantity(item.quantity - 1));
}
