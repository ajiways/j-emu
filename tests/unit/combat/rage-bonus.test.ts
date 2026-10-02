import { describe, expect, it } from "vitest";
import {
  rageBonusPctFromFill,
  rageFillFromBonusPct,
} from "../../../src/modules/combat/domain/rage-bonus.ts";

describe("rageBonusPctFromFill", () => {
  it("uses the official 50% → +18% and 100% → +50% anchors", () => {
    expect(rageBonusPctFromFill(50)).toBe(18);
    expect(rageBonusPctFromFill(100)).toBe(50);
  });

  it("lerps below 50%", () => {
    expect(rageBonusPctFromFill(25)).toBe(9);
  });
});

describe("rageFillFromBonusPct", () => {
  it("inverts the bonus curve at its anchors and in between", () => {
    expect(rageFillFromBonusPct(0)).toBe(0);
    expect(rageFillFromBonusPct(18)).toBe(50);
    expect(rageFillFromBonusPct(50)).toBe(100);
    for (const fill of [10, 35, 50, 75, 99]) {
      expect(rageFillFromBonusPct(rageBonusPctFromFill(fill))).toBeCloseTo(fill, 0);
    }
  });
});
