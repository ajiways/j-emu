import { describe, expect, it } from "vitest";
import { nextMoneyMinor } from "../../../src/modules/character/domain/next-money-minor.ts";
import { testHero } from "../../support/hero-fixtures.ts";

describe("credit money", () => {
  it("rejects a zero or non-positive credit", () => {
    expect(() => nextMoneyMinor(2500, 0)).toThrow(/positive integer/);
    expect(() => nextMoneyMinor(2500, -1)).toThrow(/positive integer/);
    expect(() => testHero().creditMoney(0)).toThrow(/positive integer/);
  });

  it("rejects an overflow past the wire integer max", () => {
    expect(() => nextMoneyMinor(2_147_483_647, 1)).toThrow(/overflow/);
    expect(() => nextMoneyMinor(2500, 2_147_481_148)).toThrow(/overflow/);
  });

  it("credits a positive amount within range", () => {
    const hero = testHero({ moneyMinor: 2500 });
    hero.creditMoney(10);
    expect(hero.moneyMinor).toBe(2510);
  });
});
