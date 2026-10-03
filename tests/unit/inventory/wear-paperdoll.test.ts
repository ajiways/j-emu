import { describe, expect, it } from "vitest";
import { ArtifactExtra } from "../../../src/modules/catalog/domain/artifact-extra.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";
import { testWearHero } from "../../support/wear-hero.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { WearDeniedError } from "../../../src/modules/inventory/domain/wear-denied-error.ts";
import { INSIGNIA_EQUIPMENT_SLOT } from "../../../src/modules/inventory/domain/paperdoll-slot.ts";
import { requireWearablePaperdoll } from "../../../src/modules/inventory/domain/wear-paperdoll.ts";

const glove = testArtifact();

describe("paperdoll wear restrictions", () => {
  const hero = testWearHero({ id: 1, level: 1, gender: 1 });

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

  describe("an emblem of the insignia slot", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 0, 0);
    const emblem = testArtifact({
      slotMask: 0,
      skills: [],
      durability: 0,
      durabilityMax: 0,
      extra: new ArtifactExtra(null, [], null, null, 0, 0, 0, 1, {
        rank: 9,
        buy: true,
        wear: true,
      }),
    });
    const holder = (rank: number) => testWearHero({ id: 1, level: 13, gender: 1 }, rank);

    it("goes to its own slot, which no paperdoll slot overlaps", () => {
      const slot = requireWearablePaperdoll(holder(9), item, emblem, new Set([32, 1]));
      expect(slot).toBe(INSIGNIA_EQUIPMENT_SLOT);
      expect(slot & ((1 << 20) - 1)).toBe(0);
    });

    it("is refused below its rank and names the rank", () => {
      expect(() => requireWearablePaperdoll(holder(8), item, emblem, new Set())).toThrow(
        "Нужно звание «Звание 9».",
      );
    });
  });
});
