import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { attachSpellTicks } from "../../../src/modules/combat/domain/fight-effect-ticks.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";
import { unitStatBase } from "../../support/stat-base.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";

function effectsWithPoison(durationSeconds: number, periodSeconds: number, castEndsTurn = false) {
  const effects = new FighterEffects({
    heroId: 1,
    base: unitStatBase(10),
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
    durationSeconds,
    periodSeconds,
    nowMs: 0,
    castEndsTurn,
    catalogPcStr: -50,
    catalogStr: 0,
    casterStrength: 15,
    casterMagPower: 0,
    casterMagResist: 0,
  });
  return effects;
}

const kinds = (items: readonly { kind: string }[]) => items.map((item) => item.kind);

describe("FighterEffects periodic effects", () => {
  it("ticks once per action and expires with the action that reaches the duration", () => {
    const effects = effectsWithPoison(80, 20);
    expect(effects.snapshot()).toMatchObject([{ remainTime: 80 }]);
    expect(kinds(effects.advanceOnAction(0, 20))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnAction(0, 20))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnAction(0, 20))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnAction(0, 20))).toEqual(["tick", "expire"]);
    expect(effects.snapshot()).toHaveLength(0);
  });

  it("holds a backlog and pays one tick per action", () => {
    const effects = effectsWithPoison(120, 20);
    expect(kinds(effects.advanceOnAction(1_000, 50))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnAction(2_000, 0))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnAction(3_000, 0))).toEqual([]);
  });

  it("ticks on the timer wherever the carrier stands, and never at the expiry instant", () => {
    const effects = effectsWithPoison(80, 20);
    expect(kinds(effects.advanceOnTimer(20_000))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnTimer(40_000))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnTimer(60_000))).toEqual(["tick"]);
    expect(kinds(effects.advanceOnTimer(80_000))).toEqual(["expire"]);
  });

  it("pays every threshold crossed at once when the timer wakes late", () => {
    const effects = effectsWithPoison(80, 20);
    expect(kinds(effects.advanceOnTimer(50_000))).toEqual(["tick", "tick"]);
  });

  it("skips the clock jump of the action that cast a turn-ending effect", () => {
    const effects = effectsWithPoison(80, 20, true);
    expect(kinds(effects.advanceOnAction(0, 20))).toEqual([]);
    expect(kinds(effects.advanceOnAction(0, 20))).toEqual(["tick"]);
  });

  it("reports the next timer wake and the time left at a given instant", () => {
    const effects = effectsWithPoison(81, 40);
    expect(effects.nextPeriodicDueMs()).toBe(40_000);
    expect(effects.snapshot(10_000)).toMatchObject([{ remainTime: 71 }]);
    effects.advanceOnTimer(40_000);
    expect(effects.nextPeriodicDueMs()).toBe(80_000);
  });

  it("rejects a tick without catalog img", () => {
    const effects = new FighterEffects({
      heroId: 1,
      base: unitStatBase(10),
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
        durationSeconds: 81,
        periodSeconds: 40,
        nowMs: 0,
        castEndsTurn: false,
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
    const caster = BotFighter.fromSeed(
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
    const carrier = new HumanFighter({
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
    expect(() => attachSpellTicks(carrier, caster, { ...card, flags: 0 }, 0, true)).toThrow(
      /447 kind 4\/5 period is required/,
    );
  });
});
