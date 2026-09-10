import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { Listing } from "./listing.ts";

export function bagItemMatchesOrder(item: InventoryItem, row: Listing): boolean {
  if (item.location.kind !== "bag") return false;
  if (item.artifactId !== row.artikulId) return false;
  if (row.requiredDurability > 0 && item.durability < row.requiredDurability) return false;
  if (row.requiredDurabilityMax > 0 && item.durabilityMax < row.requiredDurabilityMax) {
    return false;
  }
  if (row.requiredUpgradeId > 0 && item.upgrade.level < row.requiredUpgradeId) return false;
  if (row.magicId > 0) return false;
  return true;
}
