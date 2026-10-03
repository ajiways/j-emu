import { describe, expect, it } from "vitest";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import { applyDeathBreaks } from "../../../src/modules/inventory/domain/apply-death-durability.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import type { InventoryRepository } from "../../../src/modules/inventory/ports/inventory-repository.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("death break unequip", () => {
  it("saves 0 durability while worn and then uses putOff", async () => {
    const item = new InventoryItem(100_000, 1, 20, 1, { kind: "equipment", slot: 2 }, 1, 30);
    const saved: InventoryItem[] = [];
    const putOffIds: number[] = [];
    const inventory = {
      async lockForHero() {
        return [item];
      },
      async save(next: InventoryItem) {
        saved.push(next);
      },
      async delete() {
        throw new Error("a 0/N break must not delete the item");
      },
    };
    const catalog = {
      async artifact(id: number) {
        if (id !== 20) throw new Error(`unexpected artifact ${id}`);
        return testArtifact({ id: 20, slotMask: 2, durability: 30, durabilityMax: 30, flags: 0 });
      },
    };

    const result = await applyDeathBreaks(
      inventory as unknown as InventoryRepository,
      catalog as unknown as Catalog,
      { characterId: 1, random: new SequenceRandom([0, 0, 0, 0]) },
      async (_heroId, itemId) => {
        putOffIds.push(itemId);
        return "paperdoll";
      },
    );

    expect(putOffIds).toEqual([100_000]);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.durability).toBe(0);
    expect(saved[0]?.location).toEqual({ kind: "equipment", slot: 2 });
    expect(result).toEqual({
      paperdollChanged: true,
      breaks: [
        {
          itemId: 100_000,
          artifactId: 20,
          durability: 0,
          durabilityMax: 30,
          slot: 0,
        },
      ],
    });
  });
});
