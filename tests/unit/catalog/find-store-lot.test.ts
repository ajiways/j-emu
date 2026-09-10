import { describe, expect, it } from "vitest";
import { findStoreLot } from "../../../src/modules/catalog/domain/find-store-lot.ts";
import type { StoreLot } from "../../../src/modules/catalog/domain/store-lot.ts";

const lots: readonly StoreLot[] = [
  {
    areaId: "504",
    lotId: 80,
    artikulId: 23,
    typeId: -131,
    price: 1,
    ord: 8,
    pay: { currency: "gold", amount: 1 },
    requires: null,
  },
  {
    areaId: "504",
    lotId: 82,
    artikulId: 24,
    typeId: -131,
    price: 1,
    ord: 6,
    pay: { currency: "gold", amount: 1 },
    requires: null,
  },
];

describe("findStoreLot", () => {
  it("looks up by lot_id before artikul_id", () => {
    expect(findStoreLot(lots, "80")?.artikulId).toBe(23);
    expect(findStoreLot(lots, "23")?.lotId).toBe(80);
    expect(findStoreLot(lots, "82")?.artikulId).toBe(24);
    expect(findStoreLot(lots, "24")?.lotId).toBe(82);
  });

  it("returns null for an unknown key", () => {
    expect(findStoreLot(lots, "999")).toBeNull();
  });

  it("requires a key", () => {
    expect(() => findStoreLot(lots, "")).toThrow(/Store lot key is required/);
  });
});
