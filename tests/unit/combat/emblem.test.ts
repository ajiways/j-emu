import { describe, expect, it } from "vitest";
import {
  EMPTY_COMBAT_LOADOUT,
  type CombatEmblem,
} from "../../../src/modules/combat/domain/combat-loadout.ts";
import { emblemPlanOf } from "../../../src/modules/combat/domain/emblem-plan.ts";
import { fireEmblems } from "../../../src/modules/combat/domain/emblem-turn.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

/** «Эмблема задиры» (9833) as the catalog has it: three hit-point grades, one firing per fight. */
const BULLY: CombatEmblem = {
  artikulId: 9833,
  title: "Эмблема задиры",
  picture: "emblem_01_3.png",
  power: 13,
  spell: {
    animData: "magic_backstab_cast",
    triggerCount: 1,
    onlyPvP: true,
    triggers: [
      {
        conditions: [
          { type: "randomly", probability: 1, expectation: true },
          { type: "lowSelfHP", hpLevel: "60%", expectation: false },
        ],
      },
      {
        conditions: [
          { type: "randomly", probability: 2, expectation: true },
          { type: "lowSelfHP", hpLevel: "60%", expectation: true },
          { type: "lowSelfHP", hpLevel: "35%", expectation: false },
        ],
      },
      { conditions: [{ type: "lowSelfHP", hpLevel: "35%", expectation: true }] },
    ],
    effects: [
      {
        kind: 9,
        dmgType: 0,
        dmgMask: 509,
        order: -1,
        hidden: 0,
        limit: 100,
        delta: { skill: "PVP_SHIELD", abs: 0, proc: 1 },
      },
    ],
  },
};

function hero(hp: number, emblem: CombatEmblem = BULLY): HumanFighter {
  const human = new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 7,
    kind: 1,
    hp,
    maxHp: 100,
    mp: 10,
    maxMp: 10,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: { ...EMPTY_COMBAT_LOADOUT, emblems: [emblem] },
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

const NEVER = new FixedRandom(0.99);
const ALWAYS = new FixedRandom(0);
const GRADES = { ...UNIT_BATTLE_RULES, emblemChances: [0.4, 0.8] };
const fire = (human: HumanFighter, random = ALWAYS, pvp = true) =>
  fireEmblems({ human, pvp, nowMs: 0, random, rules: GRADES });

describe("an emblem of the insignia slot", () => {
  it("reads the card of the shield family and refuses what it does not know", () => {
    expect(emblemPlanOf(BULLY)).toMatchObject({
      kind: "plan",
      plan: { triggerCount: 1, onlyPvP: true, shield: { proc: 1, limitPct: 100, mask: 509 } },
    });
    const seal: CombatEmblem = {
      ...BULLY,
      spell: {
        ...BULLY.spell,
        effects: [{ kind: 9, dmgMask: 509, duration: 80, limit: "100%", delta: { skill: "X" } }],
      },
    };
    expect(emblemPlanOf(seal)).toMatchObject({ kind: "unsupported" });
    const odd: CombatEmblem = {
      ...BULLY,
      spell: { ...BULLY.spell, triggers: [{ conditions: [{ type: "moon", expectation: true }] }] },
    };
    expect(emblemPlanOf(odd)).toMatchObject({ kind: "unsupported" });
  });

  it("puts a shield of the card's power on the hero as his turn begins, and shows the cast", () => {
    const human = hero(100);
    const events = fire(human);
    expect(events.map((event) => event.type)).toEqual(["buff-cast", "effect-use"]);
    expect(events[1]).toMatchObject({ kind: 9, artikulId: 9833, persId: 1, amount: 13 });
    expect(human.effects.snapshot()).toMatchObject([{ kind: 9, amount: 13 }]);
  });

  it("fires once per fight (triggerCount 1)", () => {
    const human = hero(100);
    expect(fire(human)).toHaveLength(2);
    expect(fire(human)).toHaveLength(0);
  });

  it("rolls the grade it is in: high hp fires on a low roll, mid hp needs the stronger roll", () => {
    expect(fire(hero(100), NEVER)).toHaveLength(0);
    expect(fire(hero(100), new FixedRandom(0.39))).toHaveLength(2);
    expect(fire(hero(50), new FixedRandom(0.5))).toHaveLength(2);
    expect(fire(hero(50), new FixedRandom(0.85))).toHaveLength(0);
  });

  it("always fires below 35% of the hit points, without a roll", () => {
    expect(fire(hero(30), NEVER)).toHaveLength(2);
  });

  it("does nothing in a fight without players on both sides (onlyPvP)", () => {
    expect(fire(hero(30), ALWAYS, false)).toHaveLength(0);
  });

  it("does nothing for an emblem it cannot play", () => {
    const odd: CombatEmblem = {
      ...BULLY,
      spell: { ...BULLY.spell, triggers: [{ conditions: [{ type: "moon", expectation: true }] }] },
    };
    expect(fire(hero(30, odd))).toHaveLength(0);
  });

  it("holds back what the shield takes of a physical hit and then goes out", () => {
    const human = hero(100);
    fire(human);
    // 100 % of a hit of 10 is taken, 3 of the 13 are left.
    expect(human.effects.takenDamage(10, 1)).toBe(0);
    expect(human.effects.takeHitShield()).toEqual({ absorbed: 10, purged: [] });
    // The next hit of 10: 3 taken, 7 pass, the shield is spent.
    expect(human.effects.takenDamage(10, 1)).toBe(7);
    expect(human.effects.takeHitShield()).toMatchObject({ absorbed: 3, purged: [1] });
    expect(human.effects.snapshot()).toEqual([]);
  });

  it("does not hold back a damage type its mask leaves out", () => {
    const human = hero(100);
    fire(human);
    // 509 leaves out bit 2 (value 2).
    expect(human.effects.takenDamage(10, 2)).toBe(10);
    expect(human.effects.takeHitShield().absorbed).toBe(0);
  });
});
