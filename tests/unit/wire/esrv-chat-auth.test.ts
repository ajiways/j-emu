import { describe, expect, it } from "vitest";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { isChatAuth } from "../../../src/modules/jugger-wire/application/esrv-chat-auth.ts";

describe("esrv chat auth", () => {
  it("accepts live {rc:auth, eid:1}", () => {
    expect(isChatAuth(encodeAmf3({ rc: "auth", eid: 1 }))).toBe(true);
  });

  it("rejects an empty poll body and a non-auth envelope", () => {
    expect(isChatAuth(Buffer.alloc(0))).toBe(false);
    expect(isChatAuth(encodeAmf3({ rc: "auth", eid: 2 }))).toBe(false);
    expect(isChatAuth(encodeAmf3({ object: "common", action: "dummy" }))).toBe(false);
  });
});
