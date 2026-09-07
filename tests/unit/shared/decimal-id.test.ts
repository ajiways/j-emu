import { describe, expect, it } from "vitest";
import {
  parseDecimalId,
  requireFightSafeItemId,
  requireSafeWireInteger,
  requireWireIdentity,
} from "../../../src/shared/kernel/decimal-id.ts";

describe("decimal ids", () => {
  it("rejects non-decimal text", () => {
    expect(() => parseDecimalId("1e9", "fight id")).toThrow(/not a decimal id/);
    expect(() => parseDecimalId("-1", "fight id")).toThrow(/not a decimal id/);
    expect(() => parseDecimalId(" 1", "fight id")).toThrow(/not a decimal id/);
  });

  it("keeps values above Number.MAX_SAFE_INTEGER as bigint", () => {
    expect(parseDecimalId("9007199254740993", "fight id")).toBe(9007199254740993n);
  });

  it("converts to wire number only inside the safe integer range", () => {
    expect(requireSafeWireInteger(1n, "fight id")).toBe(1);
    expect(() => requireSafeWireInteger(9007199254740993n, "fight id")).toThrow(
      /exceeds the safe integer range/,
    );
  });

  it("rejects identity values of zero and above the wire max", () => {
    expect(requireWireIdentity(1, "hero id")).toBe(1);
    expect(() => requireWireIdentity(0, "hero id")).toThrow(/wire identity range/);
    expect(() => requireWireIdentity(2_147_483_648, "hero id")).toThrow(/wire identity range/);
  });

  it("rejects item ids outside the fight-safe range", () => {
    expect(requireFightSafeItemId(100_000n)).toBe(100_000);
    expect(() => requireFightSafeItemId(99_999n)).toThrow(/fight-safe/);
    expect(() => requireFightSafeItemId(1n)).toThrow(/fight-safe/);
    expect(() => requireFightSafeItemId(2_147_483_648n)).toThrow(/fight-safe/);
  });
});
