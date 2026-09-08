import { describe, expect, it } from "vitest";
import {
  areaEsrvChannel,
  personalEsrvChannel,
} from "../../../src/modules/jugger-wire/application/esrv-channel.ts";

describe("esrv channel keys", () => {
  it("builds personal 2: and area 131: keys", () => {
    expect(personalEsrvChannel(7)).toBe("2:7");
    expect(areaEsrvChannel("503")).toBe("131:503");
  });

  it("rejects a missing identity instead of inventing a channel", () => {
    expect(() => personalEsrvChannel(0)).toThrow(/account id/);
    expect(() => areaEsrvChannel("")).toThrow(/Area id is required/);
  });
});
