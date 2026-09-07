import type { InventoryItem, ItemLocation } from "./inventory-item.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";

export type StarterItemSpec = Readonly<{
  artifactId: number;
  quantity: number;
  location: ItemLocation;
}>;

export class InventoryService {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly starterItems: readonly StarterItemSpec[],
  ) {
    if (starterItems.length === 0) throw new Error("Starter inventory policy is required");
  }

  list(heroId: number): Promise<readonly InventoryItem[]> {
    return this.inventory.listForHero(heroId);
  }

  async ensureStarterInventory(heroId: number): Promise<void> {
    if ((await this.inventory.listForHero(heroId)).length > 0) return;
    for (const spec of this.starterItems) {
      await this.inventory.create({
        heroId,
        artifactId: spec.artifactId,
        quantity: spec.quantity,
        location: spec.location,
      });
    }
  }
}
