import { describe, expect, it } from "vitest";
import { EphemeralBotFightIds } from "../../../src/modules/combat/domain/ephemeral-bot-fight-ids.ts";

describe("EphemeralBotFightIds", () => {
  it("starts at 1000000 and skips a colliding hero id", () => {
    const ids = new EphemeralBotFightIds();
    expect(ids.allocate(1)).toBe(1_000_000);
    expect(ids.allocate(1_000_002)).toBe(1_000_001);
    expect(ids.allocate(1_000_002)).toBe(1_000_003);
  });
});
