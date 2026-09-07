import { describe, expect, it } from "vitest";
import {
  decodeAmf3,
  encodeAmf3,
  type AmfValue,
} from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodeFrames, encodeFrames } from "../../../src/modules/jugger-wire/amf/framing.ts";

describe("AMF3 codec", () => {
  const payload: AmfValue = {
    object: "common",
    action: "init",
    form: {},
    in: {},
    sq: 42,
  };

  it("round-trips the object-action associative-array shape", () => {
    expect(decodeAmf3(encodeAmf3(payload))).toEqual({
      ...payload,
      form: [],
      in: [],
    });
  });

  it("uses unsigned 32-bit length framing for realtime channels", () => {
    const encoded = encodeFrames([payload, { rc: "auth" }]);
    expect(encoded.readUInt32BE(0)).toBe(encodeAmf3(payload).length);
    expect(decodeFrames(encoded)).toEqual([{ ...payload, form: [], in: [] }, { rc: "auth" }]);
  });

  it("rejects incomplete frames instead of returning a partial result", () => {
    const encoded = encodeFrames([payload]);
    expect(() => decodeFrames(encoded.subarray(0, encoded.length - 1))).toThrow(
      /Incomplete AMF frame body/,
    );
  });
});
