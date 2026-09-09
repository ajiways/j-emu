import { describe, expect, it } from "vitest";
import {
  meleeDamageBounds,
  rollMeleeDamage,
} from "../../../src/modules/combat/domain/melee-damage.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("meleeDamageBounds", () => {
  it("scales with STR, not a Gryzl-tuned constant", () => {
    expect(meleeDamageBounds(10, UNIT_BATTLE_RULES)).toEqual({ min: 1, max: 1 });
    expect(meleeDamageBounds(15, UNIT_BATTLE_RULES)).toEqual({ min: 1, max: 2 });
    expect(meleeDamageBounds(35, UNIT_BATTLE_RULES)).toEqual({ min: 3, max: 4 });
    expect(meleeDamageBounds(45, UNIT_BATTLE_RULES)).toEqual({ min: 4, max: 5 });
    expect(meleeDamageBounds(80, UNIT_BATTLE_RULES)).toEqual({ min: 7, max: 9 });
  });

  it("rejects missing strength", () => {
    expect(() => meleeDamageBounds(0, UNIT_BATTLE_RULES)).toThrow(/positive integer/);
  });
});

describe("rollMeleeDamage", () => {
  it("uses the STR bounds", () => {
    expect(rollMeleeDamage(80, new SequenceRandom([8]), UNIT_BATTLE_RULES)).toBe(8);
    expect(rollMeleeDamage(20, new SequenceRandom([2]), UNIT_BATTLE_RULES)).toBe(2);
  });
});
