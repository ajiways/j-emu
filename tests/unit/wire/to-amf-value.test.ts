import { describe, expect, it } from "vitest";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { toAmfValue } from "../../../src/modules/jugger-wire/amf/to-amf-value.ts";

describe("toAmfValue", () => {
  it("encodes a typed wire DTO without undefined fields", () => {
    const encoded = encodeAmf3(
      toAmfValue({
        "common|init": { status: 100 },
        sq: 1,
      }),
    );
    expect(encoded.length).toBeGreaterThan(0);
  });

  it("rejects undefined object fields and non-AMF types", () => {
    expect(() => toAmfValue({ sq: undefined })).toThrow(/AMF object key sq is undefined/);
    expect(() => toAmfValue(() => 1)).toThrow(/Unsupported AMF value type function/);
  });
});
