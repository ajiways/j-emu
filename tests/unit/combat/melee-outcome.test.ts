import { describe, expect, it } from "vitest";
import {
  MELEE_REACT,
  rollMeleeOutcome,
  unpublishedBotStrikeStats,
} from "../../../src/modules/combat/domain/melee-outcome.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const attacker = unpublishedBotStrikeStats(80);
const naked = unpublishedBotStrikeStats(80);

describe("rollMeleeOutcome", () => {
  it("skips RNG and deals full raw damage when secondaries are unpublished zeros", () => {
    expect(
      rollMeleeOutcome({
        baseDamage: 8,
        attacker,
        defender: naked,
        targetHp: 20,
        forceCrit: false,
        random: new SequenceRandom([0.1]),
        rules: UNIT_BATTLE_RULES,
      }),
    ).toEqual({ applied: 8, raw: 8, react: MELEE_REACT.hit, blocked: 0 });
  });

  it("dodges before block when the defense roll is below dodge chance", () => {
    expect(
      rollMeleeOutcome({
        baseDamage: 8,
        attacker,
        defender: { ...naked, dexterity: 1 },
        targetHp: 20,
        forceCrit: false,
        random: new SequenceRandom([0]),
        rules: UNIT_BATTLE_RULES,
      }),
    ).toEqual({ applied: 0, raw: 0, react: MELEE_REACT.dodge, blocked: 0 });
  });

  it("blocks with react 2 and no HP loss", () => {
    expect(
      rollMeleeOutcome({
        baseDamage: 8,
        attacker,
        defender: { ...naked, block: 1 },
        targetHp: 20,
        forceCrit: false,
        random: new SequenceRandom([0]),
        rules: UNIT_BATTLE_RULES,
      }),
    ).toMatchObject({ applied: 0, react: MELEE_REACT.hit, blocked: 8 });
  });

  it("crits at ×2.35 and stamps react 6 or 14", () => {
    const crit = rollMeleeOutcome({
      baseDamage: 8,
      attacker: { ...attacker, rage: 1 },
      defender: naked,
      targetHp: 20,
      forceCrit: false,
      random: new SequenceRandom([0]),
      rules: UNIT_BATTLE_RULES,
    });
    expect(crit.applied).toBe(19);
    expect(crit.react).toBe(MELEE_REACT.crit);
    const kill = rollMeleeOutcome({
      baseDamage: 8,
      attacker: { ...attacker, rage: 1 },
      defender: naked,
      targetHp: 19,
      forceCrit: true,
      random: new SequenceRandom([1]),
      rules: UNIT_BATTLE_RULES,
    });
    expect(kill).toMatchObject({ applied: 19, react: MELEE_REACT.critKill });
  });
});
