import { describe, expect, it } from "vitest";
import { REPUTATION_TRACK_MAX } from "../../../src/modules/catalog/domain/reputation-ids.ts";
import { reputationGrantDelta } from "../../../src/modules/character/domain/reputation-grant-delta.ts";

describe("reputationGrantDelta", () => {
  it("grants the full amount when cap is 0", () => {
    expect(reputationGrantDelta(0, 10, 0)).toBe(10);
  });

  it("clamps the result to 7000", () => {
    expect(reputationGrantDelta(6995, 10, 0)).toBe(5);
    expect(reputationGrantDelta(REPUTATION_TRACK_MAX, 10, 0)).toBe(0);
  });

  it("skips the grant when current is already at a positive cap", () => {
    expect(reputationGrantDelta(10, 5, 10)).toBe(0);
  });

  it("clips the grant to remaining room under a positive cap", () => {
    expect(reputationGrantDelta(8, 5, 10)).toBe(2);
  });

  it("rejects a non-positive amount or negative cap", () => {
    expect(() => reputationGrantDelta(0, 0, 0)).toThrow(/positive integer/);
    expect(() => reputationGrantDelta(0, 10, -1)).toThrow(/non-negative integer/);
  });
});
