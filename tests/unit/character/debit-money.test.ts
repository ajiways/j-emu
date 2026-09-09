import { describe, expect, it } from "vitest";
import { debitMoneyMinor } from "../../../src/modules/character/domain/debit-money-minor.ts";
import { InsufficientMoneyError } from "../../../src/modules/character/domain/insufficient-money-error.ts";
import { testHero } from "../../support/hero-fixtures.ts";

describe("debit money", () => {
  it("rejects a debit that would go negative without clamping", () => {
    expect(() => debitMoneyMinor(2500, 2501)).toThrow(InsufficientMoneyError);
    expect(() => debitMoneyMinor(0, 1)).toThrow(InsufficientMoneyError);
    const hero = testHero({ moneyMinor: 2500 });
    expect(() => hero.debitMoney(2501)).toThrow(InsufficientMoneyError);
    expect(hero.moneyMinor).toBe(2500);
  });

  it("debits a positive amount that fits the balance", () => {
    const hero = testHero({ moneyMinor: 2500 });
    hero.debitMoney(200);
    expect(hero.moneyMinor).toBe(2300);
  });

  it("rejects a zero or non-positive debit", () => {
    expect(() => debitMoneyMinor(2500, 0)).toThrow(/positive integer/);
    expect(() => debitMoneyMinor(2500, -1)).toThrow(/positive integer/);
  });
});
