import type { InventoryItem, ItemLocation } from "../domain/inventory-item.ts";

export type NewInventoryItem = Readonly<{
  heroId: string;
  artifactId: number;
  quantity: number;
  location: ItemLocation;
}>;

export interface InventoryRepository {
  listForHero(heroId: string): Promise<readonly InventoryItem[]>;
  create(item: NewInventoryItem): Promise<InventoryItem>;
  save(item: InventoryItem): Promise<void>;
}
