import { describe, expect, it } from "vitest";
import type { CombatGloveSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { tryGloveKeepTurn } from "../../../src/modules/combat/domain/player-casts.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { rollSwing } from "../../../src/modules/combat/domain/swing.ts";
import {
  NO_STRIKE_MODS,
  strikeModsFromSkills,
} from "../../../src/modules/combat/domain/strike-mods.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";
import { unitStatBase } from "../../support/stat-base.ts";

function effects(): FighterEffects {
  return new FighterEffects({
    heroId: 1,
    base: unitStatBase(20),
    startedAtMs: 0,
    gearSpells: [],
    effectIds: new FightEffectIds(),
  });
}

function charge(fx: FighterEffects, artikulId: number, turns: number, skills: [string, number][]) {
  fx.attachChargingKind3({
    strike: strikeModsFromSkills(skills.map(([skillId, value]) => ({ skillId, value }))),
    sourceId: 1,
    artikulId,
    title: "t",
    img: "i.png",
    dmgType: 1,
    remainTurns: turns,
  });
}

describe("charged strike effects", () => {
  it("spends one charge of each swing effect and reports the ones that ran out", () => {
    const fx = effects();
    charge(fx, 99, 2, [["pcSTR", 43]]);
    charge(fx, 212, 1, [["pcSTR", 20]]);
    expect(fx.takeStrike()).toEqual({
      pcStrs: [43, 20],
      strFlat: 0,
      critChance: 0,
      drain: { healPct: 0, hurtPct: 0 },
      purged: [2],
      furySpent: true,
    });
    expect(fx.takeStrike()).toMatchObject({ pcStrs: [43], purged: [1] });
    expect(fx.takeStrike()).toMatchObject({ pcStrs: [], purged: [] });
  });

  it("adds flat strength and takes the best crit chance; an overlay is left for its own roll", () => {
    const fx = effects();
    charge(fx, 6773, 1, [["STR", 7]]);
    charge(fx, 9100, 1, [["CR", 1]]);
    charge(fx, 1126, 1, [["CR", 0.5]]);
    fx.attachChargingKind3({
      strike: {
        ...NO_STRIKE_MODS,
        overlay: {
          dmgType: 64,
          charges: 1,
          catalogStr: 0,
          catalogPcStr: 0,
          casterStrength: 15,
        },
      },
      sourceId: 1,
      artikulId: 397,
      title: "t",
      img: "i.png",
      dmgType: 64,
      remainTurns: 1,
    });
    expect(fx.takeStrike()).toMatchObject({ strFlat: 7, critChance: 1, purged: [1, 2, 3] });
    expect(fx.snapshot()).toHaveLength(1);
    expect(fx.takeOverlay()).toMatchObject({ purged: [4] });
  });

  it("rolls a swing with the flat strength and percent of what it spends", () => {
    const fx = effects();
    charge(fx, 99, 1, [["pcSTR", 100]]);
    charge(fx, 9100, 1, [["CR", 0.4]]);
    const swing = rollSwing(fx, 80, new FixedRandom(), UNIT_BATTLE_RULES);
    const plain = rollSwing(effects(), 80, new FixedRandom(), UNIT_BATTLE_RULES);
    expect(swing.baseDamage).toBe(plain.baseDamage * 2);
    expect(swing).toMatchObject({ forceCrit: false, critChance: 0.4 });
  });
});

describe("glove buffs follow their skills", () => {
  function hero(spell: CombatGloveSpell): HumanFighter {
    const human = new HumanFighter({
      accountId: 1,
      heroId: 1,
      nick: "H1",
      level: 7,
      kind: 1,
      hp: 50,
      maxHp: 50,
      mp: 10,
      maxMp: 10,
      team: 1,
      waiting: false,
      ...unitHuntHumanStats(20),
      startedAtMs: 0,
      loadout: {
        ...EMPTY_COMBAT_LOADOUT,
        glove: { hits: [2, 2, 2, 2, 2, 2, 2, 2], spells: [spell] },
      },
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds: new FightEffectIds(),
    });
    human.authed = true;
    human.casts.cp = 5;
    return human;
  }

  const glove = (skill: string, value: number): CombatGloveSpell => ({
    artikulId: 9100,
    cost: 1,
    row: 1,
    title: "Жажда крови",
    picture: "p.png",
    spell: {
      animData: "magic_baf",
      persRestr: {},
      targetRestr: {},
      effects: [{ kind: 3, dmgType: 1, charging: 1, skills: [{ skillId: skill, value }] }],
    },
  });

  it("makes the next swing a crit only when the buff carries CR", () => {
    const crit = hero(glove("CR", 1));
    tryGloveKeepTurn(crit, 9100, 1, false, { nowMs: 0, foe: () => crit, allies: () => [] });
    expect(crit.effects.takeStrike().critChance).toBe(1);
    const vamp = hero(glove("VAMP", 10));
    tryGloveKeepTurn(vamp, 9100, 1, false, { nowMs: 0, foe: () => vamp, allies: () => [] });
    expect(vamp.effects.takeStrike().critChance).toBe(0);
  });
});
