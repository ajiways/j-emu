import type { InventoryRepository } from "../ports/inventory-repository.ts";
import type { InventoryItem } from "./inventory-item.ts";

export function countBagByArtifact(
  items: readonly InventoryItem[],
  heroId: number,
  artifactId: number,
): number {
  if (!Number.isInteger(artifactId) || artifactId < 1) {
    throw new Error("Bag artifact id must be a positive integer");
  }
  let total = 0;
  for (const item of items) {
    if (item.heroId !== heroId || item.artifactId !== artifactId) continue;
    if (item.location.kind !== "bag") continue;
    total += item.quantity;
  }
  return total;
}

export async function consumeFromBag(
  inventory: InventoryRepository,
  items: InventoryItem[],
  heroId: number,
  artifactId: number,
  count: number,
): Promise<void> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Bag consume count must be a positive integer");
  }
  let remaining = count;
  const stacks = items
    .filter(
      (item) =>
        item.heroId === heroId && item.artifactId === artifactId && item.location.kind === "bag",
    )
    .sort((left, right) => left.id - right.id);
  for (const stack of stacks) {
    if (remaining < 1) return;
    if (stack.quantity <= remaining) {
      remaining -= stack.quantity;
      await inventory.delete(stack);
      replaceRemoved(items, stack.id);
      continue;
    }
    const next = stack.withQuantity(stack.quantity - remaining);
    remaining = 0;
    await inventory.save(next);
    replaceItem(items, next);
  }
  if (remaining > 0) {
    throw new Error(`Bag consume of artifact ${artifactId} left ${remaining} unpaid`);
  }
}

function replaceItem(items: InventoryItem[], next: InventoryItem): void {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) throw new Error(`Item ${next.id} is missing from bag consume`);
  items[index] = next;
}

function replaceRemoved(items: InventoryItem[], itemId: number): void {
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error(`Item ${itemId} is missing from bag consume`);
  items.splice(index, 1);
}
