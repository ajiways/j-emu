import type { InventoryItem, ItemLocation } from "../domain/inventory-item.ts";
import type { ItemUpgrade } from "../domain/item-upgrade.ts";

export type NewInventoryItem = Readonly<{
  heroId: number;
  artifactId: number;
  quantity: number;
  location: ItemLocation;
  durability: number;
  durabilityMax: number;
  expire: number;
  upgrade?: ItemUpgrade;
}>;

export interface InventoryRepository {
  listForHero(heroId: number): Promise<readonly InventoryItem[]>;
  lockForHero(heroId: number): Promise<readonly InventoryItem[]>;
  create(item: NewInventoryItem): Promise<InventoryItem>;
  save(item: InventoryItem): Promise<void>;
  delete(item: InventoryItem): Promise<void>;
}
