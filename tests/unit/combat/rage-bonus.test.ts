import { describe, expect, it } from "vitest";
import { rageBonusPctFromFill } from "../../../src/modules/combat/domain/rage-bonus.ts";

describe("rageBonusPctFromFill", () => {
  it("uses the official 50% → +18% and 100% → +50% anchors", () => {
    expect(rageBonusPctFromFill(50)).toBe(18);
    expect(rageBonusPctFromFill(100)).toBe(50);
  });

  it("lerps below 50%", () => {
    expect(rageBonusPctFromFill(25)).toBe(9);
  });
});
