import { describe, expect, it } from "vitest";
import { bakeTimedStatPercents } from "../../../src/modules/combat/domain/bake-timed-stat-percents.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { HuntHumanFightEffects } from "../../../src/modules/combat/domain/hunt-human-fight-effects.ts";
import { tryPairedMelee } from "../../../src/modules/combat/domain/paired-melee.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

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

describe("bakeTimedStatPercents", () => {
  it("folds pcSTR into flat STR like jgr-emu timed kind-3", () => {
    expect(bakeTimedStatPercents(53, [{ skillId: "pcSTR", value: 10 }])).toEqual({ STR: 5 });
  });
});

describe("HuntHumanFightEffects", () => {
  it("snapshots remainTime 320 and purges on the 8th ending turn", () => {
    const effects = new HuntHumanFightEffects({
      heroId: 1,
      strength: 53,
      startedAtMs: 0,
      gearSpells: [GEAR],
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
    expect(effects.standingStrength()).toBe(5);
    for (let turn = 1; turn <= 7; turn += 1) {
      expect(effects.onActorEndingTurn(turn)).toEqual([]);
      expect(effects.snapshot()[0]?.remainTime).toBe((8 - turn) * 40);
    }
    expect(effects.onActorEndingTurn(8)).toEqual([1]);
    expect(effects.snapshot()).toEqual([]);
  });

  it("purges on wall-clock expiresAtMs even if turns remain", () => {
    const effects = new HuntHumanFightEffects({
      heroId: 1,
      strength: 53,
      startedAtMs: 0,
      gearSpells: [GEAR],
    });
    expect(effects.onActorEndingTurn(320_000)).toEqual([1]);
    expect(effects.snapshot()).toEqual([]);
  });
});

describe("gear-spell melee STR", () => {
  it("uses standing kind-3 STR while the effect lives", () => {
    const attacker = new HuntHuman({
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
      strength: 53,
      startedAtMs: 0,
      loadout: { ...EMPTY_COMBAT_LOADOUT, gearSpells: [GEAR] },
      appearance: null,
    });
    attacker.authed = true;
    attacker.beginTurn(0, 20);
    expect(attacker.meleeStrength()).toBe(58);
    const defender = new HuntHuman({
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
      strength: 10,
      startedAtMs: 0,
      loadout: EMPTY_COMBAT_LOADOUT,
      appearance: null,
    });
    const resolved = tryPairedMelee(attacker, { kind: "human", human: defender }, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([7]),
      fightId: "8",
      humans: [attacker, defender],
      bot: null,
      nowMs: 0,
    });
    expect(resolved.result).toMatchObject({
      kind: "resolved",
      events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, hpChange: -7 }],
    });
  });
});
