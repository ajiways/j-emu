import { describe, expect, it } from "vitest";
import { applyPeriodicItems } from "../../../src/modules/combat/domain/apply-periodic-items.ts";
import {
  EMPTY_COMBAT_LOADOUT,
  type CombatSpell,
} from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  castSpell,
  type SpellPresentation,
} from "../../../src/modules/combat/domain/spell-cast.ts";
import { Roster } from "../../../src/modules/combat/domain/roster.ts";
import { allyTargetsOf } from "../../../src/modules/combat/domain/spell-target.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

const PRESENTATION: SpellPresentation = {
  healAnimation: null,
  effectAnimation: "",
  castAnimation: "",
  announceHeal: false,
  timedTrailingCast: false,
  selfOnly: false,
  replacesGroup: false,
};

/** «Знак жизни»: a healing effect on one's own side, nothing in its restrictions forbids a second. */
const SIGN: CombatSpell = {
  animData: "botles_healfriend_red",
  groupId: 841,
  targetRestr: { oppTeam: false, dead: false, noBot: true },
  effects: [{ kind: 5, amount: "10%", dmgType: 0, order: 1, duration: 60, period: 15 }],
};

function hero(id: number): HumanFighter {
  const human = new HumanFighter({
    accountId: id,
    heroId: id,
    nick: `H${id}`,
    level: 7,
    kind: 1,
    hp: 100,
    maxHp: 100,
    mp: 10,
    maxMp: 10,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

function rosterOfHumans(humans: readonly HumanFighter[]): Roster {
  const roster = new Roster();
  for (const human of humans) roster.add(human);
  return roster;
}

function cast(
  spell: CombatSpell,
  caster: HumanFighter,
  carrier: HumanFighter,
  artikulId = 4219,
  sequence = 1,
) {
  return castSpell({
    caster,
    foe: () => {
      throw new Error("an ally spell has no foe");
    },
    allies: [carrier],
    source: { artikulId, title: "Знак", picture: "p.png", spell, flags: 0 },
    nowMs: 0,
    presentation: PRESENTATION,
    endsTurn: false,
    sequence,
  });
}

describe("effects that stack", () => {
  it("lets a hundred healing signs stand on one carrier, each ticking on its own", () => {
    const carrier = hero(1);
    const healers = Array.from({ length: 100 }, (_, index) => hero(index + 2));
    for (const healer of healers) cast(SIGN, healer, carrier);
    expect(carrier.effects.snapshot()).toHaveLength(100);
    carrier.applyDamage(99);
    const ticks = carrier.effects.advanceOnTimer(15_000);
    expect(ticks).toHaveLength(100);
    applyPeriodicItems(carrier, ticks, new FixedRandom(), UNIT_BATTLE_RULES, [carrier, ...healers]);
    // Ten percent a tick, a hundred of them: the carrier is whole again, and what healed is booked.
    expect(carrier.hp).toBe(100);
    expect(healers.reduce((sum, healer) => sum + healer.healedOthers, 0)).toBe(99);
  });

  it("lets the same caster put the same sign again and again", () => {
    const healer = hero(1);
    const carrier = hero(2);
    for (let times = 0; times < 5; times += 1) cast(SIGN, healer, carrier);
    expect(carrier.effects.snapshot()).toHaveLength(5);
  });

  it("stacks flat buffs: each one adds its own value", () => {
    const buff: CombatSpell = {
      groupId: 900,
      targetRestr: { oppTeam: false, noBot: true },
      effects: [{ kind: 3, duration: 40, skills: [{ skillId: "CRBonus", value: 10 }] }],
    };
    const carrier = hero(1);
    cast(buff, hero(2), carrier, 6193);
    cast(buff, hero(3), carrier, 6193);
    cast(buff, hero(4), carrier, 6193);
    expect(carrier.effects.standingSkill("CRBonus")).toBe(30);
  });
});

describe("what forbids a second effect", () => {
  const forbid = (restriction: Record<string, unknown>): CombatSpell => ({
    ...SIGN,
    targetRestr: { oppTeam: false, noBot: true, ...restriction },
  });

  it("refuses a second effect of the same kind under artdeny", () => {
    const carrier = hero(1);
    const spell = forbid({ artdeny: true });
    cast(spell, hero(2), carrier);
    expect(() => cast(spell, hero(3), carrier)).toThrow(FightCastDenied);
    // Another artikul is not the same kind.
    expect(() => cast(spell, hero(3), carrier, 5000)).not.toThrow();
  });

  it("refuses a second effect of the same group under groupdeny, but not of another group", () => {
    const carrier = hero(1);
    const spell = forbid({ groupdeny: true });
    cast(spell, hero(2), carrier);
    expect(() => cast(spell, hero(3), carrier, 5000)).toThrow(FightCastDenied);
    expect(() => cast({ ...spell, groupId: 842 }, hero(3), carrier, 5001)).not.toThrow();
  });

  it("refuses a target that stands under the barred group of selgroupdeny", () => {
    const carrier = hero(1);
    cast({ ...SIGN, groupId: 946 }, hero(2), carrier, 6000);
    const spell = forbid({ selgroupdeny: { cond: true, id: 946 } });
    expect(() => cast(spell, hero(3), carrier)).toThrow(FightCastDenied);
    expect(() => cast(spell, hero(3), hero(4))).not.toThrow();
  });

  it("does not check a mob's cast: it picks what may land", () => {
    const carrier = hero(1);
    const spell = forbid({ artdeny: true });
    cast(spell, hero(2), carrier);
    const second = castSpell({
      caster: hero(3),
      foe: () => carrier,
      allies: [carrier],
      source: { artikulId: 4219, title: "Знак", picture: "p.png", spell, flags: 0 },
      nowMs: 0,
      presentation: { ...PRESENTATION, replacesGroup: true },
      endsTurn: false,
      sequence: null,
    });
    expect(second).not.toBeNull();
  });
});

describe("an instant heal of one's own side", () => {
  /** «Регенерация»: heals a teammate (not oneself) by a share of his maximum. */
  const REGENERATION: CombatSpell = {
    animData: "botles_healfriend_red",
    targetRestr: { self: false, oppTeam: false, opp: false, dead: false, noBot: true },
    effects: [{ kind: 2, amount: "30%", order: 1 }],
  };
  /** «АОЕ хилл»: no click, a few of one's own side at random. */
  const AOE_HEAL: CombatSpell = {
    animData: "magic_aoe_light",
    targetRestr: { oppTeam: false, dead: false, randTarget: true },
    effects: [{ kind: 2, amount: "20%", order: 1, targetCount: 2 }],
  };

  it("heals the clicked teammate and books it to the healer", () => {
    const healer = hero(1);
    const mate = hero(2);
    mate.applyDamage(60);
    const events = cast(REGENERATION, healer, mate, 6191);
    expect(mate.hp).toBe(70);
    expect(healer.hp).toBe(100);
    expect(events).toMatchObject([{ type: "damage", targetId: 2, hpChange: 30 }]);
    expect(healer.healedOthers).toBe(30);
  });

  it("heals only what is missing: nothing booked for hit points that were not lost", () => {
    const healer = hero(1);
    const mate = hero(2);
    mate.applyDamage(10);
    cast(REGENERATION, healer, mate, 6191);
    expect(mate.hp).toBe(100);
    expect(healer.healedOthers).toBe(10);
  });

  it("heals the caster himself without booking it when the spell may land on oneself", () => {
    const healer = hero(1);
    healer.applyDamage(50);
    const spell: CombatSpell = { ...REGENERATION, targetRestr: { oppTeam: false, noBot: true } };
    cast(spell, healer, healer, 5755);
    expect(healer.hp).toBe(80);
    expect(healer.healedOthers).toBe(0);
  });

  it("lets a heal that names no click pick its carriers at random, up to its count", () => {
    const healer = hero(1);
    const mates = [hero(2), hero(3), hero(4)];
    for (const member of [healer, ...mates]) member.applyDamage(50);
    const allies = allyTargetsOf({
      spell: AOE_HEAL,
      caster: healer,
      roster: rosterOfHumans([healer, ...mates]),
      targetId: null,
      sequence: 1,
      random: new FixedRandom(),
    });
    expect(allies).toHaveLength(2);
    const events = castSpell({
      caster: healer,
      foe: () => healer,
      allies,
      source: { artikulId: 8281, title: "АОЕ хилл", picture: "p.png", spell: AOE_HEAL, flags: 0 },
      nowMs: 0,
      presentation: PRESENTATION,
      endsTurn: false,
      sequence: 1,
    });
    expect(events).toHaveLength(2);
    expect(allies.every((member) => member.hp === 70)).toBe(true);
  });
});
