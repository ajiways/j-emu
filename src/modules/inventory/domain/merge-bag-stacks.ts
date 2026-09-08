import type { InventoryItem } from "./inventory-item.ts";

export type StackMutation = Readonly<{
  save: readonly InventoryItem[];
  delete: readonly InventoryItem[];
}>;

export function planMergeBagStacks(
  items: readonly InventoryItem[],
  incoming: InventoryItem,
  bagStack: number,
): StackMutation {
  if (incoming.location.kind !== "bag") {
    throw new Error(`Item ${incoming.id} must be in the bag to merge`);
  }
  if (!Number.isInteger(bagStack) || bagStack < 1) {
    throw new Error("bagStack must be a positive integer");
  }
  const others = items
    .filter(
      (item) =>
        item.id !== incoming.id &&
        item.heroId === incoming.heroId &&
        item.artifactId === incoming.artifactId &&
        item.location.kind === "bag",
    )
    .sort((left, right) => left.id - right.id);
  let remaining = incoming.quantity;
  const save: InventoryItem[] = [];
  for (const other of others) {
    if (remaining < 1) break;
    const room = bagStack - other.quantity;
    if (room < 1) continue;
    const move = Math.min(remaining, room);
    save.push(other.withQuantity(other.quantity + move));
    remaining -= move;
  }
  if (remaining < 1) {
    return { save, delete: [incoming] };
  }
  if (remaining === incoming.quantity && save.length === 0) {
    return { save: [incoming], delete: [] };
  }
  return { save: [...save, incoming.withQuantity(remaining)], delete: [] };
}
