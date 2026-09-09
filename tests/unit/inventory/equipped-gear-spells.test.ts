import { describe, expect, it } from "vitest";
import { ArtifactExtra } from "../../../src/modules/catalog/domain/artifact-extra.ts";
import { equippedGearSpells } from "../../../src/modules/inventory/domain/equipped-gear-spells.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

describe("equippedGearSpells", () => {
  it("returns extra.spell only when effects are nonempty", () => {
    const withEffects = testArtifact({
      id: 93,
      extra: new ArtifactExtra(
        {
          cooldown: 20,
          effects: [{ kind: 2, amount: 15 }],
        },
        [],
        null,
        null,
        0,
        0,
        0,
      ),
    });
    const recruit = testArtifact({ id: 30 });
    const items = [
      new InventoryItem(100_001, 1, 93, 1, { kind: "equipment", slot: 32 }, 0, 0),
      new InventoryItem(100_002, 1, 30, 1, { kind: "equipment", slot: 2 }, 30, 30),
      new InventoryItem(100_003, 1, 93, 1, { kind: "bag" }, 0, 0),
    ];
    expect(
      equippedGearSpells(
        items,
        new Map([
          [93, withEffects],
          [30, recruit],
        ]),
      ),
    ).toEqual([{ cooldown: 20, effects: [{ kind: 2, amount: 15 }] }]);
  });
});
