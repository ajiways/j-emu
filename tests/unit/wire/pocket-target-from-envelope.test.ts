import { describe, expect, it } from "vitest";
import { PocketDeniedError } from "../../../src/modules/inventory/domain/pocket-denied-error.ts";
import { SLOT_EFFECT } from "../../../src/modules/inventory/domain/pocket-slot.ts";
import { decodeObjectActionEnvelope } from "../../../src/modules/jugger-wire/commands/oa/object-action-envelope.ts";
import { pocketTargetFromEnvelope } from "../../../src/modules/jugger-wire/commands/oa/pocket-target-from-envelope.ts";

describe("pocketTargetFromEnvelope", () => {
  it("treats omitted and zero slot_num as no pocket intent", () => {
    expect(pocketTargetFromEnvelope(envelope({}))).toBeUndefined();
    expect(pocketTargetFromEnvelope(envelope({ slot_num: 0 }))).toBeUndefined();
  });

  it("treats SLOT_EFFECT as auto and 1-based cells as explicit", () => {
    expect(pocketTargetFromEnvelope(envelope({ slot_num: SLOT_EFFECT }))).toBe("auto");
    expect(pocketTargetFromEnvelope(envelope({ slot_num: 2 }))).toBe(2);
  });

  it("reads slot_num from form when in is omitted", () => {
    expect(
      pocketTargetFromEnvelope(
        decodeObjectActionEnvelope({
          object: "common",
          action: "object",
          form: { code: "PUT_ON", artifact_id: 100_000, slot_num: 3 },
          sq: 1,
        }),
      ),
    ).toBe(3);
  });

  it("rejects a non-finite slot_num", () => {
    expect(() => pocketTargetFromEnvelope(envelope({ slot_num: "x" }))).toThrow(PocketDeniedError);
  });
});

function envelope(input: Record<string, unknown>) {
  return decodeObjectActionEnvelope({
    object: "common",
    action: "object",
    form: { code: "PUT_ON", artifact_id: 100_000 },
    in: input,
    sq: 1,
  });
}
