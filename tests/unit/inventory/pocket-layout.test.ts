import { describe, expect, it } from "vitest";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { planMergeBagStacks } from "../../../src/modules/inventory/domain/merge-bag-stacks.ts";
import { PocketDeniedError } from "../../../src/modules/inventory/domain/pocket-denied-error.ts";
import {
  isLeftPocket,
  pocketCntMax,
  SLOT_EFFECT,
} from "../../../src/modules/inventory/domain/pocket-slot.ts";
import { planPutOnPocket } from "../../../src/modules/inventory/domain/put-on-pocket.ts";
import { bagActionsFor } from "../../../src/modules/inventory/domain/bag-actions.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

const elixir = testArtifact({
  id: 93,
  title: "Малый эликсир жизни",
  picture: "bottles_live1_2712.png",
  typeId: "7",
  kindId: 154,
  slotMask: SLOT_EFFECT,
  weight: 100,
  priceMinor: 100,
  flags: 0,
  bagStack: 99,
  skills: [],
});

const orb = testArtifact({
  id: 99,
  title: "Малый усиливающий орб",
  picture: "bottles_sila1.png",
  typeId: "7",
  kindId: 152,
  slotMask: 603_979_776,
  weight: 10,
  priceMinor: 15,
  flags: 0,
  bagStack: 999,
  skills: [],
});

describe("pocket slot rules", () => {
  it("treats EFFECT-only masks as pocketable", () => {
    expect(isLeftPocket(SLOT_EFFECT)).toBe(true);
    expect(isLeftPocket(603_979_776)).toBe(true);
  });

  it("rejects paperdoll bits even when EFFECT is set", () => {
    expect(isLeftPocket(32)).toBe(false);
    expect(isLeftPocket(SLOT_EFFECT | 32)).toBe(false);
  });

  it("uses floor(100/weight) with a minimum of 1", () => {
    expect(pocketCntMax(100)).toBe(1);
    expect(pocketCntMax(10)).toBe(10);
    expect(pocketCntMax(1)).toBe(100);
    expect(() => pocketCntMax(0)).toThrow(/positive integer/);
  });

  it("adds PUT_ON to bag actions for pocketables", () => {
    expect(bagActionsFor(SLOT_EFFECT, false, false, false)).toBe(11);
    expect(bagActionsFor(32, false, false, false)).toBe(11);
    expect(bagActionsFor(0, true, false, false)).toBe(7);
  });
});

describe("planPutOnPocket", () => {
  it("splits a bag stack that exceeds pocketCntMax into an empty slot", () => {
    const item = new InventoryItem(100_000, 1, 93, 2, { kind: "bag" }, 0, 0);
    const mutation = planPutOnPocket({
      items: [item],
      itemId: item.id,
      definition: elixir,
      capacity: 4,
      target: "auto",
    });
    expect(mutation.save).toEqual([item.withQuantity(1)]);
    expect(mutation.create).toEqual([
      {
        heroId: 1,
        artifactId: 93,
        quantity: 1,
        location: { kind: "pocket", position: 1 },
        durability: 0,
        durabilityMax: 0,
      },
    ]);
    expect(mutation.delete).toEqual([]);
  });

  it("merges a bag orb into an incomplete pocket stack and keeps the leftover", () => {
    const pocket = new InventoryItem(100_000, 1, 99, 7, { kind: "pocket", position: 1 }, 0, 0);
    const bag = new InventoryItem(100_001, 1, 99, 8, { kind: "bag" }, 0, 0);
    const mutation = planPutOnPocket({
      items: [pocket, bag],
      itemId: bag.id,
      definition: orb,
      capacity: 4,
      target: 1,
    });
    expect(mutation.save).toEqual([pocket.withQuantity(10), bag.withQuantity(5)]);
    expect(mutation.create).toEqual([]);
    expect(mutation.delete).toEqual([]);
  });

  it("splits a bag orb larger than pocketCntMax into an empty slot", () => {
    const item = new InventoryItem(100_000, 1, 99, 15, { kind: "bag" }, 0, 0);
    const mutation = planPutOnPocket({
      items: [item],
      itemId: item.id,
      definition: orb,
      capacity: 4,
      target: "auto",
    });
    expect(mutation.save).toEqual([item.withQuantity(5)]);
    expect(mutation.create).toEqual([
      {
        heroId: 1,
        artifactId: 99,
        quantity: 10,
        location: { kind: "pocket", position: 1 },
        durability: 0,
        durabilityMax: 0,
      },
    ]);
  });

  it("swaps different pocket stacks", () => {
    const first = new InventoryItem(100_000, 1, 93, 1, { kind: "pocket", position: 1 }, 0, 0);
    const second = new InventoryItem(100_001, 1, 99, 10, { kind: "pocket", position: 2 }, 0, 0);
    const mutation = planPutOnPocket({
      items: [first, second],
      itemId: first.id,
      definition: elixir,
      capacity: 4,
      target: 2,
    });
    expect(mutation.save).toEqual([
      first.withLocation({ kind: "bag" }),
      second.withLocation({ kind: "pocket", position: 1 }),
      first.withLocation({ kind: "pocket", position: 2 }),
    ]);
  });

  it("displaces a different artikul from the target cell back to the bag", () => {
    const occupant = new InventoryItem(100_000, 1, 99, 10, { kind: "pocket", position: 1 }, 0, 0);
    const incoming = new InventoryItem(100_001, 1, 93, 1, { kind: "bag" }, 0, 0);
    const mutation = planPutOnPocket({
      items: [occupant, incoming],
      itemId: incoming.id,
      definition: elixir,
      capacity: 4,
      target: 1,
    });
    expect(mutation.save).toEqual([
      occupant.withLocation({ kind: "bag" }),
      incoming.withLocation({ kind: "pocket", position: 1 }),
    ]);
  });

  it("rejects a paperdoll glove on the belt", () => {
    const glove = new InventoryItem(100_000, 1, 9095, 1, { kind: "bag" }, 3, 3);
    expect(() =>
      planPutOnPocket({
        items: [glove],
        itemId: glove.id,
        definition: testArtifact(),
        capacity: 4,
        target: 1,
      }),
    ).toThrow(PocketDeniedError);
    expect(() =>
      planPutOnPocket({
        items: [glove],
        itemId: glove.id,
        definition: testArtifact(),
        capacity: 4,
        target: 1,
      }),
    ).toThrow(PocketDeniedError.cannotWear);
  });
});

describe("planMergeBagStacks", () => {
  it("merges a pocket PUT_OFF remainder into an existing bag stack", () => {
    const bag = new InventoryItem(100_000, 1, 93, 1, { kind: "bag" }, 0, 0);
    const incoming = new InventoryItem(100_001, 1, 93, 1, { kind: "bag" }, 0, 0);
    expect(planMergeBagStacks([bag, incoming], incoming, 99)).toEqual({
      save: [bag.withQuantity(2)],
      delete: [incoming],
    });
  });
});
