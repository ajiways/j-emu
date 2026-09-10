import { describe, expect, it } from "vitest";
import { bagItemMatchesOrder } from "../../../src/modules/auction/domain/listing-match.ts";
import { LISTING_KIND_TENDER } from "../../../src/modules/auction/domain/listing-kind.ts";
import { LISTING_STATUS_OPEN } from "../../../src/modules/auction/domain/listing-status.ts";
import type { Listing } from "../../../src/modules/auction/domain/listing.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { UNUPGRADED } from "../../../src/modules/inventory/domain/item-upgrade.ts";

const now = new Date("2026-01-01T00:00:00Z");

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    kind: LISTING_KIND_TENDER,
    status: LISTING_STATUS_OPEN,
    ownerHeroId: 1,
    ownerKind: 1,
    artikulId: 23,
    title: "Перчатка",
    kindId: 44,
    quality: 0,
    levelMin: 1,
    amount: 2,
    startPriceMinor: 0,
    buyoutMinor: 1000,
    currentBidMinor: 1000,
    bidderHeroId: null,
    cancelFeeMinor: 100,
    expiresAt: now,
    createdAt: now,
    attachment: {
      originalItemId: 0,
      artifactId: 23,
      quantity: 1,
      durability: 30,
      durabilityMax: 30,
      upgradeId: 0,
      upgradeLevel: 0,
      upgradeSkillId: "",
      upgradeBound: 0,
    },
    wholeStackOnly: 0,
    requiredDurability: 0,
    requiredDurabilityMax: 0,
    magicId: 0,
    requiredUpgradeId: 0,
    ...overrides,
  };
}

function bagItem(overrides: { durability?: number; durabilityMax?: number; level?: number } = {}) {
  return new InventoryItem(
    100_000,
    2,
    23,
    1,
    { kind: "bag" },
    overrides.durability ?? 30,
    overrides.durabilityMax ?? 30,
    overrides.level ? { id: 1, level: overrides.level, skillId: "STR", bound: false } : UNUPGRADED,
    0,
  );
}

describe("tender bag match", () => {
  it("matches bag artikul and rejects pocket, durability, upgrade, and magic filters", () => {
    expect(bagItemMatchesOrder(bagItem(), listing())).toBe(true);
    expect(
      bagItemMatchesOrder(
        new InventoryItem(100_001, 2, 23, 1, { kind: "pocket", position: 1 }, 30, 30),
        listing(),
      ),
    ).toBe(false);
    expect(
      bagItemMatchesOrder(bagItem({ durability: 5 }), listing({ requiredDurability: 10 })),
    ).toBe(false);
    expect(
      bagItemMatchesOrder(
        bagItem({ durability: 5, durabilityMax: 5 }),
        listing({ requiredDurabilityMax: 10 }),
      ),
    ).toBe(false);
    expect(bagItemMatchesOrder(bagItem(), listing({ requiredUpgradeId: 2 }))).toBe(false);
    expect(bagItemMatchesOrder(bagItem({ level: 3 }), listing({ requiredUpgradeId: 2 }))).toBe(
      true,
    );
    expect(bagItemMatchesOrder(bagItem(), listing({ magicId: 7 }))).toBe(false);
  });
});
