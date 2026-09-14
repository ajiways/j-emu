import { describe, expect, it } from "vitest";
import {
  POCKET_SPELL_WIRE_FLAGS,
  pocketSpellWireFlags,
} from "../../../src/modules/combat/domain/pocket-spell-wire-flags.ts";

describe("pocket spell wire flags", () => {
  it("uses catalog flags when Pub1 AMF published them", () => {
    expect(pocketSpellWireFlags("0")).toBe("0");
    expect(pocketSpellWireFlags(POCKET_SPELL_WIRE_FLAGS)).toBe(POCKET_SPELL_WIRE_FLAGS);
  });

  it("uses live pocket wire flags when catalog extra.spell.flags is omitted", () => {
    expect(pocketSpellWireFlags(undefined)).toBe(POCKET_SPELL_WIRE_FLAGS);
    expect(pocketSpellWireFlags("")).toBe(POCKET_SPELL_WIRE_FLAGS);
  });
});
