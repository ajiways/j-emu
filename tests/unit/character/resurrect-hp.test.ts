import { describe, expect, it } from "vitest";
import { resurrectHp } from "../../../src/modules/character/domain/resurrect-hp.ts";

describe("resurrectHp", () => {
  it("uses max(2, floor(hpMax * 0.05))", () => {
    expect(resurrectHp(10)).toBe(2);
    expect(resurrectHp(15)).toBe(2);
    expect(resurrectHp(100)).toBe(5);
  });

  it("rejects a non-positive hpMax", () => {
    expect(() => resurrectHp(0)).toThrow(/positive integer/);
  });
});
