import { describe, expect, it } from "vitest";
import {
  craftTrainCap,
  rollCraftXp,
} from "../../../src/modules/professions/domain/craft-formulas.ts";

describe("craft formulas", () => {
  it("caps training at min(recipe max, level cap)", () => {
    expect(craftTrainCap(0, 60, 59)).toBe(59);
    expect(craftTrainCap(0, 60, 119)).toBe(60);
  });

  it("hits the 90% band when unit is 0 and misses at 0.99", () => {
    expect(rollCraftXp(1, 0, 59, { unit: () => 0 })).toBe(true);
    expect(rollCraftXp(1, 0, 59, { unit: () => 0.99 })).toBe(false);
    expect(rollCraftXp(59, 0, 59, { unit: () => 0 })).toBe(false);
  });
});
