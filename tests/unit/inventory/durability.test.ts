import { describe, expect, it } from "vitest";
import {
  applyBreak,
  applyRepair,
  canRepair,
  instanceDurability,
  isBroken,
  pickDeathBreaks,
  repairCostGold,
  tracksDurability,
} from "../../../src/modules/inventory/domain/durability.ts";

describe("durability formulas", () => {
  it("tracks finite max and infinite flags together", () => {
    expect(tracksDurability(instanceDurability(0, 0, 0))).toBe(false);
    expect(tracksDurability(instanceDurability(3, 3, 40))).toBe(true);
    expect(tracksDurability(instanceDurability(0, 0, 1 | 536_870_912))).toBe(true);
  });

  it("treats current 0 as broken only when tracking", () => {
    expect(isBroken(instanceDurability(0, 0, 0))).toBe(false);
    expect(isBroken(instanceDurability(0, 30, 0))).toBe(true);
  });

  it("allows repair only when current is below max", () => {
    expect(canRepair(instanceDurability(30, 30, 0))).toBe(false);
    expect(canRepair(instanceDurability(29, 30, 0))).toBe(true);
  });

  it("decrements current and destroys finite 1/1", () => {
    expect(applyBreak(30, 30, false)).toEqual({ current: 29, max: 30, destroy: false });
    expect(applyBreak(1, 1, false)).toEqual({ current: 0, max: 1, destroy: true });
    expect(applyBreak(1, 1, true)).toEqual({ current: 0, max: 1, destroy: false });
  });

  it("repairs finite items to (max-1)/(max-1)", () => {
    expect(applyRepair(0, 30, false)).toEqual({ current: 29, max: 29 });
    expect(applyRepair(2, 10, true)).toEqual({ current: 10, max: 10 });
  });

  it("caps repair gold at 50 and rounds to cents", () => {
    expect(repairCostGold(1)).toBe(0.02);
    expect(repairCostGold(0)).toBe(0);
    expect(repairCostGold(10_000)).toBe(50);
  });

  it("picks the whole pool when it is smaller than 4", () => {
    const picked = pickDeathBreaks(["a", "b"], { unit: () => 0 });
    expect(picked).toHaveLength(2);
  });
});
