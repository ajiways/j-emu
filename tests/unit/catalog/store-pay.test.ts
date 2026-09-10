import { describe, expect, it } from "vitest";
import {
  addStorePay,
  emptyStorePayTotals,
  parseStorePay,
} from "../../../src/modules/catalog/domain/store-pay.ts";

describe("parseStorePay", () => {
  it("parses gold, diamond, and barter without substituting a currency", () => {
    expect(parseStorePay({ currency: "gold", amount: 1 })).toEqual({ currency: "gold", amount: 1 });
    expect(parseStorePay({ currency: "diamond", amount: 3 })).toEqual({
      currency: "diamond",
      amount: 3,
    });
    expect(parseStorePay({ currency: "barter", artikulId: 77, count: 2 })).toEqual({
      currency: "barter",
      artikulId: 77,
      count: 2,
    });
  });

  it("fails closed on an unknown currency", () => {
    expect(() => parseStorePay({ currency: "dungeon", amount: 1 })).toThrow(
      /currency dungeon is not supported/,
    );
  });
});

describe("addStorePay", () => {
  it("accumulates barter by catalog artikulId across basket lines", () => {
    const totals = addStorePay(
      addStorePay(emptyStorePayTotals(), { currency: "barter", artikulId: 77, count: 2 }, 1),
      { currency: "barter", artikulId: 77, count: 1 },
      3,
    );
    expect(totals.barter.get(77)).toBe(5);
  });
});
