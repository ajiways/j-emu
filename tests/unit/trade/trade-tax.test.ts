import { describe, expect, it } from "vitest";
import { moneyRound, tradeTax, trayTax } from "../../../src/modules/trade/domain/trade-tax.ts";

describe("trade tax", () => {
  it("empty value is 0", () => {
    expect(tradeTax(0)).toBe(0);
    expect(trayTax(0, [])).toBe(0);
  });

  it("matches live 5×0.62 dump float", () => {
    expect(trayTax(0, [{ priceGold: 0.62, quantity: 5 }])).toBeCloseTo(0.551298, 5);
  });

  it("settle rounds commission to 2dp", () => {
    expect(moneyRound(0.551298)).toBe(0.55);
  });
});
