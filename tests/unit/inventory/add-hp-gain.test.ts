import { describe, expect, it } from "vitest";
import { amountFromParams } from "../../../src/modules/inventory/domain/amount-from-params.ts";
import { addHpGain } from "../../../src/modules/inventory/domain/add-hp-gain.ts";

describe("addHpGain", () => {
  it("uses percent of hpMax when param2 is 0", () => {
    expect(addHpGain(10, 30, 0)).toBe(3);
    expect(addHpGain(1, 30, 0)).toBe(1);
  });

  it("uses absolute param1 when param2 is not 0", () => {
    expect(addHpGain(10, 15, 1)).toBe(15);
  });

  it("fails fast when param1 is missing or not positive", () => {
    expect(() => addHpGain(10, 0, 0)).toThrow(/param1 is required and must be > 0/);
    expect(() => addHpGain(10, Number.NaN, 0)).toThrow(/param1 is required and must be > 0/);
  });
});

describe("ADD_MP amountFromParams", () => {
  it("uses the same percent formula against mpMax", () => {
    expect(amountFromParams(20, 30, 0, "ADD_MP")).toBe(6);
  });
});
