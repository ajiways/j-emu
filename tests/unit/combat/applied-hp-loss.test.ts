import { describe, expect, it } from "vitest";
import { appliedHpLoss } from "../../../src/modules/combat/domain/applied-hp-loss.ts";

describe("appliedHpLoss", () => {
  it("keeps raw when it fits in remaining HP", () => {
    expect(appliedHpLoss(7, 20)).toBe(7);
  });

  it("clamps overkill to remaining HP", () => {
    expect(appliedHpLoss(7, 3)).toBe(3);
  });
});
