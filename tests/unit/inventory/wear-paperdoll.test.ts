import { describe, expect, it } from "vitest";
import { ArtifactDefinition } from "../../../src/modules/catalog/domain/artifact-definition.ts";
import { ArtifactSkillBonus } from "../../../src/modules/catalog/domain/artifact-skill-bonus.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { WearDeniedError } from "../../../src/modules/inventory/domain/wear-denied-error.ts";
import { requireWearablePaperdoll } from "../../../src/modules/inventory/domain/wear-paperdoll.ts";

const glove = new ArtifactDefinition(
  9095,
  "Ветхая магическая перчатка",
  "artifact_9095.png",
  "2",
  44,
  32,
  0,
  1,
  0,
  0,
  [new ArtifactSkillBonus("VIT", 5, 0)],
);

describe("paperdoll wear restrictions", () => {
  const hero = { id: 1, level: 1, gender: 1 };

  it("picks the catalog paperdoll slot for a bag glove", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" });
    expect(requireWearablePaperdoll(hero, item, glove, new Set())).toBe(32);
  });

  it("rejects a level-gated item", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" });
    const gated = new ArtifactDefinition(
      9095,
      "Ветхая магическая перчатка",
      "artifact_9095.png",
      "2",
      44,
      32,
      0,
      8,
      0,
      0,
      [],
    );
    expect(() => requireWearablePaperdoll(hero, item, gated, new Set())).toThrow(WearDeniedError);
    expect(() => requireWearablePaperdoll(hero, item, gated, new Set())).toThrow(/С 8 уровня/);
  });

  it("rejects a gender-locked item", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" });
    const female = new ArtifactDefinition(
      9095,
      "Ветхая магическая перчатка",
      "artifact_9095.png",
      "2",
      44,
      32,
      0,
      1,
      0,
      2,
      [],
    );
    expect(() => requireWearablePaperdoll(hero, item, female, new Set())).toThrow(
      /Этот предмет нельзя надеть/,
    );
  });

  it("rejects a non-paperdoll item", () => {
    const item = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" });
    const unwearable = new ArtifactDefinition(
      9095,
      "Ветхая магическая перчатка",
      "artifact_9095.png",
      "2",
      44,
      0,
      0,
      1,
      0,
      0,
      [],
    );
    expect(() => requireWearablePaperdoll(hero, item, unwearable, new Set())).toThrow(
      /Этот предмет нельзя надеть/,
    );
  });
});
