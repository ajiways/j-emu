import { describe, expect, it } from "vitest";
import { consumeByArtikul } from "../../../src/modules/inventory/domain/consume-by-artikul.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import type { InventoryRepository } from "../../../src/modules/inventory/ports/inventory-repository.ts";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";

describe("consumeByArtikul", () => {
  it("consumes bag before paperdoll", async () => {
    const bag = new InventoryItem(100_001, 1, 23, 1, { kind: "bag" }, 0, 0);
    const worn = new InventoryItem(100_002, 1, 23, 1, { kind: "equipment", slot: 32 }, 0, 0);
    const inventory = new MemoryInventory([bag, worn]);
    await consumeByArtikul(inventory, unusedCatalog(), {
      characterId: 1,
      artifactId: 23,
      quantity: 1,
      allowPaperdoll: true,
    });
    expect(inventory.items.map((row) => row.id)).toEqual([100_002]);
  });

  it("skips paperdoll while the fight lock is held", async () => {
    const worn = new InventoryItem(100_002, 1, 23, 1, { kind: "equipment", slot: 32 }, 0, 0);
    const inventory = new MemoryInventory([worn]);
    await consumeByArtikul(inventory, unusedCatalog(), {
      characterId: 1,
      artifactId: 23,
      quantity: 1,
      allowPaperdoll: false,
    });
    expect(inventory.items).toHaveLength(1);
  });

  it("skips when the artikul is missing", async () => {
    const inventory = new MemoryInventory([]);
    await consumeByArtikul(inventory, unusedCatalog(), {
      characterId: 1,
      artifactId: 23,
      quantity: 1,
      allowPaperdoll: true,
    });
    expect(inventory.items).toEqual([]);
  });
});

function unusedCatalog(): Catalog {
  return {
    artifact: async () => {
      throw new Error("catalog must not run on bag consume or skip");
    },
  } as unknown as Catalog;
}

class MemoryInventory implements InventoryRepository {
  constructor(readonly items: InventoryItem[]) {}

  async listForHero(): Promise<readonly InventoryItem[]> {
    return this.items;
  }

  async lockForHero(): Promise<readonly InventoryItem[]> {
    return this.items;
  }

  async create(): Promise<InventoryItem> {
    throw new Error("create is not used");
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
