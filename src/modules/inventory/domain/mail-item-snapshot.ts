import type { InventoryItem } from "./inventory-item.ts";
import type { ItemInstanceData } from "./item-instance-data.ts";
import type { ItemUpgrade } from "./item-upgrade.ts";

export type MailItemSnapshot = Readonly<{
  originalItemId: number;
  artifactId: number;
  quantity: number;
  durability: number;
  durabilityMax: number;
  upgrade: ItemUpgrade;
  data: ItemInstanceData;
}>;

export function mailItemSnapshotFromItem(item: InventoryItem, quantity: number): MailItemSnapshot {
  return {
    originalItemId: item.id,
    artifactId: item.artifactId,
    quantity,
    durability: item.durability,
    durabilityMax: item.durabilityMax,
    upgrade: item.upgrade,
    data: item.data,
  };
}
