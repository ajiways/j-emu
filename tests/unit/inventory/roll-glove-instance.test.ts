import { describe, expect, it } from "vitest";
import { ArtifactExtra } from "../../../src/modules/catalog/domain/artifact-extra.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { rollGloveInstance } from "../../../src/modules/inventory/domain/roll-glove-instance.ts";
import { gloveInstanceFromItem } from "../../../src/modules/jugger-wire/application/glove-instance-wire.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

describe("roll glove instance", () => {
  it("picks artikul_id0 when set and uses catalog hits", () => {
    const extra = new ArtifactExtra(
      null,
      [{ cost: 2, row: 1, artikulId0: 9098, pool: [497, 179] }],
      [2, 3, 2, 3, 1, 2, 3, 1],
      null,
      0,
      0,
      0,
    );
    expect(rollGloveInstance(extra, () => 0.9)).toEqual({
      hits: [2, 3, 2, 3, 1, 2, 3, 1],
      spells: [{ artikul_id: 9098, cost: 2, row: 1 }],
    });
  });

  it("rolls hits and a pool spell when artikul_id0 is 0", () => {
    const extra = new ArtifactExtra(
      null,
      [{ cost: 6, row: 1, artikulId0: 0, pool: [497, 179, 499] }],
      null,
      null,
      0,
      0,
      0,
    );
    const values = [0, 0, 0, 0, 0, 0, 0, 0, 0.9];
    expect(
      rollGloveInstance(extra, () => {
        const next = values.shift();
        if (next === undefined) throw new Error("rng exhausted");
        return next;
      }),
    ).toEqual({
      hits: [1, 1, 1, 1, 1, 1, 1, 1],
      spells: [{ artikul_id: 499, cost: 6, row: 1 }],
    });
  });
});

describe("glove instance from item", () => {
  it("expands rolled pool spells instead of catalog artikul_id0", async () => {
    const glove = testArtifact({
      id: 23,
      extra: new ArtifactExtra(
        null,
        [{ cost: 6, row: 1, artikulId0: 0, pool: [497, 179] }],
        null,
        null,
        0,
        0,
        0,
      ),
    });
    const spell = testArtifact({
      id: 179,
      title: "Пул",
      picture: "pool.png",
      kindId: 65,
      slotMask: 0,
    });
    const item = new InventoryItem(100_000, 1, 23, 1, { kind: "bag" }, 30, 30, undefined, 0, {
      hits: [1, 2, 3, 1, 2, 3, 1, 2],
      spells: [{ artikul_id: 179, cost: 6, row: 1 }],
    });
    await expect(
      gloveInstanceFromItem(glove, item, {
        artifact: async (id) => (id === 179 ? spell : id === 23 ? glove : null),
      }),
    ).resolves.toMatchObject({
      hits: [1, 2, 3, 1, 2, 3, 1, 2],
      spells: [{ id: 179, artikul_id: 179, artikul_id0: 179, cost: 6, row: 1 }],
    });
  });
});
