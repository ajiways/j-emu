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
    expect(
      parseStorePay({
        currency: "bundle",
        gold: 3000,
        barter: [{ artikulId: 5823, count: 500 }],
      }),
    ).toEqual({
      currency: "bundle",
      gold: 3000,
      barter: [{ artikulId: 5823, count: 500 }],
    });
    expect(parseStorePay({ currency: "gold", amount: 0.06 })).toEqual({
      currency: "gold",
      amount: 0.06,
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

  it("adds gold and multiple barter costs from a bundle lot", () => {
    const totals = addStorePay(
      emptyStorePayTotals(),
      {
        currency: "bundle",
        gold: 3000,
        barter: [
          { artikulId: 5823, count: 500 },
          { artikulId: 3815, count: 500 },
        ],
      },
      2,
    );
    expect(totals.gold).toBe(6000);
    expect(totals.barter.get(5823)).toBe(1000);
    expect(totals.barter.get(3815)).toBe(1000);
  });
});
