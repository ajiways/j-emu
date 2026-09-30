import { describe, expect, it } from "vitest";
import { stunTurns } from "../../../src/modules/combat/domain/stun-turns.ts";

describe("stunTurns", () => {
  it("reads a turn-counted stun", () => {
    expect(stunTurns({ effects: [{ kind: 18, duration: 2, durationInTurns: true }] }, 1)).toBe(2);
  });

  it("refuses a timed stun instead of guessing what its seconds cost", () => {
    expect(() => stunTurns({ effects: [{ kind: 18, duration: 40 }] }, 7489)).toThrow(/timed/);
  });

  it("requires a stun effect with a duration", () => {
    expect(() => stunTurns({ effects: [{ kind: 3 }] }, 5)).toThrow(/duration is required/);
    expect(() => stunTurns({ effects: [{ kind: 18 }] }, 5)).toThrow(/duration is required/);
  });
});
