import { describe, expect, it } from "vitest";
import { bookInstancesWire } from "../../../src/modules/instance/domain/book-instances-wire.ts";

describe("book instances wire", () => {
  it("lists live binds as active and expired binds as blocked", () => {
    expect(
      bookInstancesWire(
        [
          { artikulId: "6", expiresUnix: 1_000_060 },
          { artikulId: "1", expiresUnix: 999_999 },
        ],
        1_000_000,
      ),
    ).toEqual({
      status: 100,
      active: { "0": { artikul_id: "6" } },
      blocked: { "0": { artikul_id: "1", dtime: 999_999 } },
    });
  });

  it("returns empty maps when nothing is bound", () => {
    expect(bookInstancesWire([], 1)).toEqual({ status: 100, active: {}, blocked: {} });
  });
});
