import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { attachSpellTicks } from "../../../src/modules/combat/domain/fight-effect-ticks.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { HuntRosterBot } from "../../../src/modules/combat/domain/hunt-roster-bot.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HuntHumanFightEffects } from "../../../src/modules/combat/domain/hunt-human-fight-effects.ts";

describe("HuntHumanFightEffects ticks", () => {
  it("budgets duration/period pulses and drops the effect on the last tick", () => {
    const effects = new HuntHumanFightEffects({
      heroId: 1,
      strength: 10,
      startedAtMs: 0,
      gearSpells: [],
      effectIds: new FightEffectIds(),
    });
    effects.attachTick({
      kind: 4,
      sourceId: 1_000_000,
      artikulId: 396,
      title: "Ядовитый плевок",
      img: "hissa_magic1.png",
      dmgType: 64,
      ticks: 4,
      catalogPcStr: -50,
      catalogStr: 0,
      casterStrength: 15,
      casterMagPower: 0,
      casterMagResist: 0,
    });
    expect(effects.snapshot()).toHaveLength(1);
    const first = effects.takeTickPulses();
    expect(first).toEqual([
      {
        effectId: 1,
        kind: 4,
        sourceId: 1_000_000,
        dmgType: 64,
        catalogPcStr: -50,
        catalogStr: 0,
        casterStrength: 15,
        casterMagPower: 0,
        casterMagResist: 0,
        last: false,
      },
    ]);
    effects.takeTickPulses();
    effects.takeTickPulses();
    const last = effects.takeTickPulses();
    expect(last[0]?.last).toBe(true);
    expect(effects.snapshot()).toHaveLength(0);
  });

  it("rejects a tick without catalog img", () => {
    const effects = new HuntHumanFightEffects({
      heroId: 1,
      strength: 10,
      startedAtMs: 0,
      gearSpells: [],
      effectIds: new FightEffectIds(),
    });
    expect(() =>
      effects.attachTick({
        kind: 4,
        sourceId: 1_000_000,
        artikulId: 396,
        title: "Ядовитый плевок",
        img: "",
        dmgType: 64,
        ticks: 3,
        catalogPcStr: -50,
        catalogStr: 0,
        casterStrength: 15,
        casterMagPower: 0,
        casterMagResist: 0,
      }),
    ).toThrow(/img is required/);
  });
});

describe("attachSpellTicks period", () => {
  it("requires a catalog period on a kind-4/5 spell", () => {
    const effectIds = new FightEffectIds();
    const caster = HuntRosterBot.fromSeed(
      {
        fightId: 1_000_000,
        artikulId: 4,
        nick: "Хисса",
        level: 2,
        hp: 30,
        strength: 15,
        initiative: 0,
        magPower: 0,
        magResist: 0,
        avatar: "avatar_hissa1_sm.jpg",
        sk: "16",
        body: "",
        spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      },
      2,
      effectIds,
    );
    const carrier = new HuntHuman({
      accountId: 1,
      heroId: 1,
      nick: "H1",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      team: 1,
      waiting: false,
      ...unitHuntHumanStats(80),
      startedAtMs: 0,
      loadout: EMPTY_COMBAT_LOADOUT,
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds,
    });
    const card = {
      artikulId: 447,
      title: "Ветхий знак погибели",
      picture: "znak_death1.png",
      slot: "turn_roulette" as const,
      weight: 1,
      maxCasts: null,
      gate: null,
      hpPct: null,
      spell: { effects: [{ kind: 4, dmgType: 256, duration: 120 }] },
    };
    expect(() => attachSpellTicks(carrier, caster, card)).toThrow(
      /447 kind 4\/5 period is required/,
    );
  });
});
