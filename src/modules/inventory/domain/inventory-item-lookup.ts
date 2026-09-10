import type { InventoryItem } from "./inventory-item.ts";
import { DropDeniedError } from "./drop-denied-error.ts";

export function requireHeroItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item) throw new Error(`Item ${itemId} for hero ${heroId} is missing`);
  return item;
}

export function requireDropItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
  intent: "drop" | "sell",
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item || item.heroId !== heroId) throw DropDeniedError.forIntent(intent);
  return item;
}

export function occupiedEquipmentSlots(
  items: readonly InventoryItem[],
  exceptItemId: number,
): Set<number> {
  const occupied = new Set<number>();
  for (const item of items) {
    if (item.id === exceptItemId || item.location.kind !== "equipment") continue;
    occupied.add(item.location.slot);
  }
  return occupied;
}

export function pocketPosition(item: InventoryItem): number {
  if (item.location.kind !== "pocket") {
    throw new Error(`Item ${item.id} is not in the pocket`);
  }
  return item.location.position;
}
