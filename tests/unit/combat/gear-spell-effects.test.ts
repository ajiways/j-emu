import { describe, expect, it } from "vitest";
import { bakeSkills } from "../../../src/modules/combat/domain/skill-bake.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";
import { humanMeleeTarget } from "../../../src/modules/combat/domain/melee-target.ts";
import { tryPairedMelee } from "../../../src/modules/combat/domain/paired-melee.ts";
import { unitStatBase } from "../../support/stat-base.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

const GEAR = {
  artikulId: 20546,
  title: "Изначальная мифическая перчатка тирана VI",
  picture: "dosp_tir_mif_mag.png",
  spell: {
    groupId: 936,
    persRestr: {},
    targetRestr: { self: true, selgroupdeny: {} },
    effects: [
      {
        kind: 3,
        dmgType: 0,
        duration: 320,
        forceSelfTargeting: true,
        realStartTime: true,
        skills: [{ skillId: "pcSTR", value: 10 }],
      },
    ],
  },
} as const;

describe("bakeSkills", () => {
  it("folds pcSTR into flat STR and drops the multiplier", () => {
    expect(bakeSkills([{ skillId: "pcSTR", value: 10 }], unitStatBase(53))).toEqual({ STR: 5 });
  });

  it("bakes live 182 against the hero's own dexterity: 36 with 19 and 23% gives 32 and 1.23", () => {
    const skills = [
      { skillId: "DEX", value: 19 },
      { skillId: "pcDEX", value: 23 },
    ];
    expect(bakeSkills(skills, unitStatBase(5, { DEX: 36 }))).toEqual({ DEX: 32, pcDEX: 1.23 });
  });

  it("bakes live 169: 35% of 111 max hp gives HPMAX 39 and 1.35", () => {
    const baked = bakeSkills([{ skillId: "pcHPMAX", value: 35 }], unitStatBase(5, { HPMAX: 111 }));
    expect(baked).toEqual({ HPMAX: 39, pcHPMAX: 1.35 });
  });

  it("folds RAG like the old server (183: 87 with 19 and 23% gives 43) and drops the multiplier", () => {
    const skills = [
      { skillId: "RAG", value: 19 },
      { skillId: "pcRAG", value: 23 },
    ];
    expect(bakeSkills(skills, unitStatBase(5, { RAG: 87 }))).toEqual({ RAG: 43 });
  });

  it("passes skills it does not bake through untouched", () => {
    expect(bakeSkills([{ skillId: "DFR", value: 0.4 }], unitStatBase(5))).toEqual({ DFR: 0.4 });
  });
});

describe("FighterEffects", () => {
  it("ages a gear buff on the fight clock: 320 s, purged by the action that reaches it", () => {
    const effects = new FighterEffects({
      heroId: 1,
      base: unitStatBase(53),
      startedAtMs: 0,
      gearSpells: [GEAR],
      effectIds: new FightEffectIds(),
    });
    expect(effects.snapshot()).toEqual([
      {
        id: 1,
        kind: 3,
        sourceId: 1,
        artikulId: 20546,
        title: GEAR.title,
        img: "dosp_tir_mif_mag.png",
        dmgType: 0,
        remainTime: 320,
        groupId: 936,
        skills: { STR: 5 },
      },
    ]);
    expect(effects.standingSkill("STR")).toBe(5);
    for (let action = 1; action <= 7; action += 1) {
      expect(effects.advanceOnAction(0, 40)).toEqual([]);
      expect(effects.snapshot()[0]?.remainTime).toBe(320 - action * 40);
    }
    expect(effects.advanceOnAction(0, 40)).toEqual([{ kind: "expire", effectId: 1 }]);
    expect(effects.snapshot()).toEqual([]);
  });

  it("also ends a gear buff on real time alone", () => {
    const effects = new FighterEffects({
      heroId: 1,
      base: unitStatBase(53),
      startedAtMs: 0,
      gearSpells: [GEAR],
      effectIds: new FightEffectIds(),
    });
    expect(effects.advanceOnTimer(320_000, false)).toEqual([{ kind: "expire", effectId: 1 }]);
    expect(effects.snapshot()).toEqual([]);
  });

  it("attaches pocket charging kind-3 without STR bake and purges on a physical hit, not an ending turn", () => {
    const effects = new FighterEffects({
      heroId: 1,
      base: unitStatBase(53),
      startedAtMs: 0,
      gearSpells: [],
      effectIds: new FightEffectIds(),
    });
    expect(
      effects.attachChargingKind3({
        sourceId: 1,
        artikulId: 99,
        title: "Малый усиливающий орб",
        img: "bottles_sila1.png",
        dmgType: 1,
        remainTurns: 1,
        groupId: 842,
      }),
    ).toMatchObject({
      id: 1,
      kind: 3,
      artikulId: 99,
      remainTime: 40,
      groupId: 842,
      skills: {},
    });
    expect(effects.standingSkill("STR")).toBe(0);
    expect(effects.snapshot()).toHaveLength(1);
    expect(effects.consumeChargingHit()).toEqual([1]);
    expect(effects.snapshot()).toEqual([]);
  });
});

describe("gear-spell melee STR", () => {
  it("uses standing kind-3 STR while the effect lives", () => {
    const attacker = new HumanFighter({
      accountId: 1,
      heroId: 1,
      nick: "H1",
      level: 7,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      team: 1,
      waiting: false,
      ...unitHuntHumanStats(53),
      startedAtMs: 0,
      loadout: { ...EMPTY_COMBAT_LOADOUT, gearSpells: [GEAR] },
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds: new FightEffectIds(),
    });
    attacker.authed = true;
    attacker.beginTurn(0, 20);
    expect(attacker.meleeStrength()).toBe(58);
    const defender = new HumanFighter({
      accountId: 2,
      heroId: 2,
      nick: "H2",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      team: 2,
      waiting: false,
      ...unitHuntHumanStats(10),
      startedAtMs: 0,
      loadout: EMPTY_COMBAT_LOADOUT,
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds: new FightEffectIds(),
    });
    const resolved = tryPairedMelee(attacker, humanMeleeTarget(defender), "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([7]),
      fightId: "8",
      humans: [attacker, defender],
      bots: [],
      nowMs: 0,
    });
    expect(resolved.result).toMatchObject({
      kind: "resolved",
      events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, hpChange: -7 }],
    });
  });
});
