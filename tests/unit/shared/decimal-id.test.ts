import { describe, expect, it } from "vitest";
import {
  parseDecimalId,
  requireFightSafeItemId,
  requireSafeWireInteger,
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
    expect(requireSafeWireInteger(200_000n, "participant id")).toBe(200_000);
    expect(() => requireSafeWireInteger(9007199254740993n, "participant id")).toThrow(
      /exceeds the safe integer range/,
    );
  });

  it("rejects item ids outside the fight-safe range", () => {
    expect(requireFightSafeItemId(1_000_000_000n)).toBe(1_000_000_000);
    expect(() => requireFightSafeItemId(999_999_999n)).toThrow(/fight-safe/);
    expect(() => requireFightSafeItemId(2_147_483_648n)).toThrow(/fight-safe/);
  });
});
