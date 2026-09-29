import { describe, expect, it } from "vitest";
import { macrosReferencedBy } from "../../../src/app/text-macros.ts";

const key = (n: string): string => n.repeat(32);

describe("macrosReferencedBy", () => {
  it("resolves each referenced key once, in text order", () => {
    const list = { [key("a")]: { key_id: key("a") }, [key("b")]: { key_id: key("b") } };
    const found = macrosReferencedBy(
      `x [[MAP ${key("b")}]] y [[ARTIFACT_IMG ${key("a")}]] [[MAP ${key("b")}]]`,
      list,
    );
    expect(found.map((m) => m.key)).toEqual([key("b"), key("a")]);
    expect(found[0]?.token).toBe(`[[MAP ${key("b")}]]`);
  });

  it("fails on a token missing from macros_list and on a non-object list", () => {
    expect(() => macrosReferencedBy(`[[MAP ${key("c")}]]`, {})).toThrow("is missing");
    expect(() => macrosReferencedBy("plain", [])).toThrow("macros_list must be an object");
    expect(macrosReferencedBy("plain", {})).toEqual([]);
  });
});
