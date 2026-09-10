import { describe, expect, it } from "vitest";
import {
  consumeFromBag,
  countBagByArtifact,
} from "../../../src/modules/inventory/domain/consume-from-bag.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import type { InventoryRepository } from "../../../src/modules/inventory/ports/inventory-repository.ts";

describe("consumeFromBag", () => {
  it("matches catalog artifactId even when the bag instance id is different", async () => {
    const stack = new InventoryItem(100_001, 1, 77, 3, { kind: "bag" }, 0, 0);
    const inventory = new MemoryInventory([stack]);
    expect(countBagByArtifact(inventory.items, 1, 77)).toBe(3);
    expect(countBagByArtifact(inventory.items, 1, 100_001)).toBe(0);
    await consumeFromBag(inventory, [...inventory.items], 1, 77, 2);
    expect(inventory.items).toEqual([
      expect.objectContaining({ id: 100_001, artifactId: 77, quantity: 1 }),
    ]);
  });

  it("consumes older instance rows first", async () => {
    const first = new InventoryItem(100_001, 1, 77, 1, { kind: "bag" }, 0, 0);
    const second = new InventoryItem(100_002, 1, 77, 2, { kind: "bag" }, 0, 0);
    const inventory = new MemoryInventory([second, first]);
    await consumeFromBag(inventory, [...inventory.items], 1, 77, 2);
    expect(inventory.items.map((row) => ({ id: row.id, quantity: row.quantity }))).toEqual([
      { id: 100_002, quantity: 1 },
    ]);
  });
});

class MemoryInventory implements InventoryRepository {
  constructor(readonly items: InventoryItem[]) {}

  async listForHero(): Promise<readonly InventoryItem[]> {
    return this.items;
  }

  async lockForHero(): Promise<readonly InventoryItem[]> {
    return this.items;
  }

  async create(): Promise<InventoryItem> {
    throw new Error("create is not used by consumeFromBag");
  }

  async save(item: InventoryItem): Promise<void> {
    const index = this.items.findIndex((row) => row.id === item.id);
    if (index < 0) throw new Error(`Item ${item.id} is missing`);
    this.items[index] = item;
  }

  async delete(item: InventoryItem): Promise<void> {
    const index = this.items.findIndex((row) => row.id === item.id);
    if (index < 0) throw new Error(`Item ${item.id} is missing`);
    this.items.splice(index, 1);
  }
}
