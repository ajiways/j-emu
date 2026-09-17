import { describe, expect, it } from "vitest";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { mailItemSnapshotFromItem } from "../../../src/modules/inventory/domain/mail-item-snapshot.ts";

describe("mail item snapshot", () => {
  it("copies instance data so a later grant keeps rolled glove cards", () => {
    const data = {
      hits: [1, 2, 3, 1, 2, 3, 1, 2],
      spells: [{ artikul_id: 179, cost: 6, row: 1 }],
    };
    const item = new InventoryItem(100_000, 1, 23, 1, { kind: "bag" }, 30, 30, undefined, 0, data);
    expect(mailItemSnapshotFromItem(item, 1)).toMatchObject({
      originalItemId: 100_000,
      artifactId: 23,
      quantity: 1,
      durability: 30,
      durabilityMax: 30,
      data,
    });
  });
});
