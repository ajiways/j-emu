import { describe, expect, it } from "vitest";
import { ArtifactSkillBonus } from "../../../src/modules/catalog/domain/artifact-skill-bonus.ts";
import { computeBagLoad } from "../../../src/modules/inventory/domain/bag-load.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { requireQuantityWithinStack } from "../../../src/modules/inventory/domain/require-quantity-within-stack.ts";
import { sellPriceMinor } from "../../../src/modules/inventory/domain/sell-price.ts";
import { takeDropQuantity } from "../../../src/modules/inventory/domain/take-drop-quantity.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

describe("sell price", () => {
  it("is 0 when catalog price is 0", () => {
    expect(sellPriceMinor(0)).toBe(0);
  });

  it("is one tenth of catalog price in minor units", () => {
    expect(sellPriceMinor(100)).toBe(10);
    expect(sellPriceMinor(2500)).toBe(250);
  });

  it("caps at 40 gold", () => {
    expect(sellPriceMinor(50_000)).toBe(4000);
    expect(sellPriceMinor(40_000)).toBe(4000);
  });
});

describe("drop amount coerce", () => {
  it("takes the whole stack when amount is omitted, non-positive, or non-finite", () => {
    expect(takeDropQuantity(3, undefined)).toBe(3);
    expect(takeDropQuantity(3, 0)).toBe(3);
    expect(takeDropQuantity(3, -2)).toBe(3);
    expect(takeDropQuantity(3, Number.NaN)).toBe(3);
    expect(takeDropQuantity(3, Number.POSITIVE_INFINITY)).toBe(3);
  });

  it("takes min(floor(amount), have)", () => {
    expect(takeDropQuantity(5, 2)).toBe(2);
    expect(takeDropQuantity(5, 2.9)).toBe(2);
    expect(takeDropQuantity(5, 9)).toBe(5);
  });
});

describe("bag load", () => {
  it("counts noweight rows in total but not amount", () => {
    const glove = testArtifact({ flags: 40, bagStack: 1 });
    const weighted = testArtifact({
      id: 1,
      flags: 0,
      slotMask: 0,
      bagStack: 10,
      skills: [],
    });
    const items = [
      new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 3, 3),
      new InventoryItem(100_001, 1, 1, 2, { kind: "bag" }, 0, 0),
    ];
    const load = computeBagLoad(
      items,
      new Map([
        [9095, glove],
        [1, weighted],
      ]),
      20,
    );
    expect(load).toEqual({ amount: 1, total: 2, amountMax: 20 });
  });

  it("adds equipped CAPACITY to amountMax", () => {
    const bag = testArtifact({
      id: 80,
      slotMask: 0,
      flags: 0,
      skills: [new ArtifactSkillBonus("CAPACITY", 5, 0)],
    });
    const items = [new InventoryItem(100_000, 1, 80, 1, { kind: "equipment", slot: 1 }, 0, 0)];
    expect(computeBagLoad(items, new Map([[80, bag]]), 20)).toEqual({
      amount: 0,
      total: 0,
      amountMax: 25,
    });
  });
});

describe("unique wearable stack", () => {
  it("rejects quantity above bagStack 1", () => {
    const wearable = testArtifact({ bagStack: 1 });
    expect(() => requireQuantityWithinStack(wearable, 2)).toThrow(/exceeds bagStack 1/);
    expect(() => requireQuantityWithinStack(wearable, 1)).not.toThrow();
  });
});
