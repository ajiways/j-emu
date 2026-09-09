import { describe, expect, it } from "vitest";
import { goldToMinor } from "../../../src/modules/character/shared/gold-to-minor.ts";

describe("goldToMinor", () => {
  it("converts 1.00 gold to 100 minor units", () => {
    expect(goldToMinor(1)).toBe(100);
    expect(goldToMinor(1.0)).toBe(100);
  });

  it("rejects a negative or non-finite amount", () => {
    expect(() => goldToMinor(-1)).toThrow(/Gold amount is invalid/);
    expect(() => goldToMinor(Number.NaN)).toThrow(/Gold amount is invalid/);
  });
});
