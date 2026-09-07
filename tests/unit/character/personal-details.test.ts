import { describe, expect, it } from "vitest";
import { PersonalDetails } from "../../../src/modules/character/domain/personal-details.ts";

describe("PersonalDetails", () => {
  it("starts empty and merges sparse keys", () => {
    const merged = PersonalDetails.empty().merge({
      pondViewLast: "0",
      tutorial2: '{"finished":true}',
    });
    expect(merged.info).toEqual({
      pondViewLast: "0",
      tutorial2: '{"finished":true}',
    });
  });

  it("keeps previous keys when a later patch is sparse", () => {
    const first = PersonalDetails.empty().merge({ pondViewLast: "0", Chat: { mute: 1 } });
    const second = first.merge({ pondViewLast: "1" });
    expect(second.info).toEqual({ pondViewLast: "1", Chat: { mute: 1 } });
  });

  it("skips undefined patch values", () => {
    const merged = PersonalDetails.empty().merge({
      pondViewLast: "0",
      skipped: undefined,
    });
    expect(merged.info).toEqual({ pondViewLast: "0" });
  });

  it("rejects non-JSON values", () => {
    expect(() => PersonalDetails.empty().merge({ bad: 1n })).toThrow(/unsupported type bigint/);
  });

  it("rejects payloads over the documented size limit", () => {
    const oversized = "x".repeat(PersonalDetails.MAX_JSON_BYTES);
    expect(() => PersonalDetails.empty().merge({ blob: oversized })).toThrow(/exceed 16384 bytes/);
  });

  it("rejects a stored array", () => {
    expect(() => PersonalDetails.fromStored([])).toThrow(/must be a JSON object/);
  });
});
