import { describe, expect, it } from "vitest";
import { MELEE_REACT, rollMeleeOutcome } from "../../../src/modules/combat/domain/melee-outcome.ts";
import type { StrikeStats } from "../../../src/modules/combat/domain/melee-outcome.ts";
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
