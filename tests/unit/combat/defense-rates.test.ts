import { describe, expect, it } from "vitest";
import {
  MELEE_REACT,
  NO_CRIT_MOD,
  rollMeleeOutcome,
} from "../../../src/modules/combat/domain/melee-outcome.ts";
import type { CritMod, StrikeStats } from "../../../src/modules/combat/domain/melee-outcome.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";

const PLAIN: StrikeStats = {
  strength: 50,
  rage: 0,
  dexterity: 0,
  defense: 0,
  block: 0,
  takePhysical: (raw) => raw,
  dodgeRate: 0,
  blockRate: 0,
  critMod: NO_CRIT_MOD,
};

function hit(defender: StrikeStats, unit = 0.5) {
  return rollMeleeOutcome({
    baseDamage: 10,
    attacker: PLAIN,
    defender,
    targetHp: 100,
    forceCrit: false,
    critChance: 0,
    random: new FixedRandom(unit),
    rules: UNIT_BATTLE_RULES,
  });
}

describe("absolute defense rates", () => {
  it("lands a plain hit when nothing defends", () => {
    expect(hit(PLAIN)).toMatchObject({ react: MELEE_REACT.hit });
    expect(hit(PLAIN).applied).toBeGreaterThan(0);
  });

  it("DR replaces the dexterity dodge: 1 always dodges, a low rate loses to a high roll", () => {
    expect(hit({ ...PLAIN, dodgeRate: 1 })).toMatchObject({ applied: 0, react: MELEE_REACT.dodge });
    expect(hit({ ...PLAIN, dodgeRate: 0.15 }, 0.5).applied).toBeGreaterThan(0);
    expect(hit({ ...PLAIN, dodgeRate: 0.6 }, 0.5)).toMatchObject({ react: MELEE_REACT.dodge });
  });

  it("BR adds an absolute block chance: 1 always blocks", () => {
    const blocked = hit({ ...PLAIN, blockRate: 1 });
    expect(blocked.applied).toBe(0);
    expect(blocked.blocked).toBeGreaterThan(0);
    expect(hit({ ...PLAIN, blockRate: 0.15 }, 0.9).applied).toBeGreaterThan(0);
  });
});

describe("crit chance skills of the striker", () => {
  const strike = (critMod: CritMod, unit: number) =>
    rollMeleeOutcome({
      baseDamage: 10,
      attacker: { ...PLAIN, critMod },
      defender: PLAIN,
      targetHp: 100,
      forceCrit: false,
      critChance: 0,
      random: new FixedRandom(unit),
      rules: UNIT_BATTLE_RULES,
    }).react;

  it("CRBonus adds percentage points on top of the usual chance", () => {
    expect(strike(NO_CRIT_MOD, 0.2)).toBe(MELEE_REACT.hit);
    expect(strike({ ...NO_CRIT_MOD, bonus: 27 }, 0.2)).toBe(MELEE_REACT.crit);
    expect(strike({ ...NO_CRIT_MOD, bonus: 27 }, 0.3)).toBe(MELEE_REACT.hit);
  });

  it("pcCRBonus and pcCR cut what they change", () => {
    expect(strike({ pcCr: 0, bonus: 27, pcBonus: -99 }, 0.2)).toBe(MELEE_REACT.hit);
    expect(strike({ pcCr: -80, bonus: 27, pcBonus: 0 }, 0.2)).toBe(MELEE_REACT.crit);
  });
});
