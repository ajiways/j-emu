import { describe, expect, it } from "vitest";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  manaToSpend,
  payMana,
  requireMana,
} from "../../../src/modules/combat/domain/spell-mana.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

const FIXED: CombatSpell = { mpCost: 6, effects: [{ kind: 10, botArtikulId: 1 }] };
const RANGE: CombatSpell = { mpCost: 3, effects: [{ kind: 10, botArtikulId: 2, manaCost: 7 }] };
const FREE: CombatSpell = { effects: [{ kind: 3, duration: 10 }] };

function hero(mp: number): HumanFighter {
  return new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 7,
    kind: 1,
    hp: 50,
    maxHp: 50,
    mp,
    maxMp: 20,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

describe("spell mana", () => {
  it("takes a fixed cost and reports it", () => {
    const caster = hero(10);
    expect(payMana(caster, FIXED)).toEqual({ type: "mp-change", targetId: 1, delta: -6 });
    expect(caster.mp).toBe(4);
  });

  it("takes everything up to the top of a spend range", () => {
    expect(manaToSpend(RANGE, 5)).toBe(5);
    expect(manaToSpend(RANGE, 15)).toBe(10);
    expect(() => manaToSpend(RANGE, 2)).toThrow(/needs 3 mana/);
  });

  it("charges nothing for a spell without a cost", () => {
    const caster = hero(10);
    expect(payMana(caster, FREE)).toBeNull();
    expect(caster.mp).toBe(10);
  });

  it("refuses an unaffordable cast before anything is spent", () => {
    const caster = hero(5);
    expect(() => requireMana(caster, FIXED, 9)).toThrow();
    expect(caster.mp).toBe(5);
  });
});
