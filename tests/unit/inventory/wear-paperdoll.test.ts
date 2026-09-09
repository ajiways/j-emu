import { describe, expect, it } from "vitest";
import { testArtifact } from "../../support/artifact-fixtures.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { WearDeniedError } from "../../../src/modules/inventory/domain/wear-denied-error.ts";
import { requireWearablePaperdoll } from "../../../src/modules/inventory/domain/wear-paperdoll.ts";

const glove = testArtifact();

describe("paperdoll wear restrictions", () => {
  const hero = { id: 1, level: 1, gender: 1 };

  it("picks the catalog paperdoll slot for a bag glove", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 3, 3);
    expect(requireWearablePaperdoll(hero, item, glove, new Set())).toBe(32);
  });

  it("rejects a level-gated item", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 3, 3);
    const gated = testArtifact({ levelMin: 8, skills: [] });
    expect(() => requireWearablePaperdoll(hero, item, gated, new Set())).toThrow(WearDeniedError);
    expect(() => requireWearablePaperdoll(hero, item, gated, new Set())).toThrow(/С 8 уровня/);
  });

  it("rejects a gender-locked item", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 3, 3);
    const female = testArtifact({ gender: 2, skills: [] });
    expect(() => requireWearablePaperdoll(hero, item, female, new Set())).toThrow(
      /Этот предмет нельзя надеть/,
    );
  });

  it("rejects a non-paperdoll item", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 3, 3);
    const unwearable = testArtifact({ slotMask: 0, skills: [] });
    expect(() => requireWearablePaperdoll(hero, item, unwearable, new Set())).toThrow(
      /Этот предмет нельзя надеть/,
    );
  });

  it("rejects a broken paperdoll item with BrokenItemError", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 0, 3);
    expect(() => requireWearablePaperdoll(hero, item, glove, new Set())).toThrow(
      "Эту вещь нельзя надеть!",
    );
  });
});
