import type { InventoryRepository } from "../ports/inventory-repository.ts";
import type { PocketMutation } from "./put-on-pocket.ts";

export async function applyInventoryMutation(
  inventory: InventoryRepository,
  mutation: PocketMutation,
): Promise<void> {
  for (const item of mutation.save) await inventory.save(item);
  for (const item of mutation.create) await inventory.create(item);
  for (const item of mutation.delete) await inventory.delete(item);
}
