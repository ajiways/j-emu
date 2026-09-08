import type { InventoryItem, ItemLocation } from "../domain/inventory-item.ts";

export type NewInventoryItem = Readonly<{
  heroId: number;
  artifactId: number;
  quantity: number;
  location: ItemLocation;
}>;

export interface InventoryRepository {
  listForHero(heroId: number): Promise<readonly InventoryItem[]>;
  lockForHero(heroId: number): Promise<readonly InventoryItem[]>;
  create(item: NewInventoryItem): Promise<InventoryItem>;
  save(item: InventoryItem): Promise<void>;
}
