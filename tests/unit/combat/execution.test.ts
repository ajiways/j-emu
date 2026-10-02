import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { isExecution } from "../../../src/modules/combat/domain/execution.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { tryPairedMelee } from "../../../src/modules/combat/domain/paired-melee.ts";
import { RAGE_EFFECT_ARTIKUL_ID } from "../../../src/modules/combat/domain/rage-bonus.ts";
import { NO_STRIKE_MODS } from "../../../src/modules/combat/domain/strike-mods.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";
import { rosterOf } from "../../support/roster-of.ts";

function human(
  heroId: number,
  team: 1 | 2,
  hp: number,
  level: number,
  strength = 10,
  lifetimeExecutions = 0,
) {
  const fighter = new HumanFighter({
    accountId: heroId,
    heroId,
    nick: `H${heroId}`,
    level,
    kind: 1,
    hp,
    maxHp: hp,
    mp: 10,
    maxMp: 10,
    team,
    waiting: false,
    ...unitHuntHumanStats(strength),
    startedAtMs: 0,
    loadout: { ...EMPTY_COMBAT_LOADOUT, lifetimeExecutions },
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  fighter.authed = true;
  return fighter;
}

function strikeWithFury(
  attacker: HumanFighter,
  defender: HumanFighter,
  fury: boolean,
): ReturnType<typeof tryPairedMelee> {
  attacker.beginTurn(0, 20);
  if (fury) {
    attacker.effects.attachChargingKind3({
      strike: { ...NO_STRIKE_MODS, pcStr: 50 },
      sourceId: attacker.id,
      artikulId: RAGE_EFFECT_ARTIKUL_ID,
      title: "Ярость",
      img: "rageeffect_2702.png",
      dmgType: 1,
      remainTurns: 1,
    });
  }
  return tryPairedMelee(attacker, defender, "center", {
    finished: false,
    rules: UNIT_BATTLE_RULES,
    random: new FixedRandom(),
    fightId: "8",
    roster: rosterOf([attacker, defender], []),
    nowMs: 0,
  });
}

function hitOf(resolved: ReturnType<typeof tryPairedMelee>) {
  if (resolved.result.kind !== "resolved") throw new Error("the strike should resolve");
  return resolved.result.events.find((event) => event.type === "damage");
}

describe("an execution", () => {
  it("is a killing swing with the rage button, four times the victim's hit points and the level gate", () => {
    const attacker = human(1, 1, 50, 5, 400);
    const victim = human(2, 2, 3, 5);
    const hit = hitOf(strikeWithFury(attacker, victim, true));
    expect(hit).toMatchObject({ killed: true, fatality: "fatality1", react: 10 });
    expect(attacker.executedVictimIds()).toEqual([2]);
    expect(victim.executed).toBe(true);
  });

  it("shows an animation the earlier executions of the hero unlocked", () => {
    // The 50th execution unlocks the second blow; the roll below takes the last of the pool.
    const attacker = human(1, 1, 50, 5, 400, 49);
    const victim = human(2, 2, 3, 5);
    attacker.beginTurn(0, 20);
    attacker.effects.attachChargingKind3({
      strike: { ...NO_STRIKE_MODS, pcStr: 50 },
      sourceId: attacker.id,
      artikulId: RAGE_EFFECT_ARTIKUL_ID,
      title: "Ярость",
      img: "rageeffect_2702.png",
      dmgType: 1,
      remainTurns: 1,
    });
    const resolved = tryPairedMelee(attacker, victim, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: { integer: (min, max) => (min === 0 ? max : min), unit: () => 0.99 },
      fightId: "8",
      roster: rosterOf([attacker, victim], []),
      nowMs: 0,
    });
    expect(hitOf(resolved)).toMatchObject({ fatality: "fatality2" });
  });

  it("does not happen without the rage button, even for a huge blow", () => {
    const attacker = human(1, 1, 50, 5, 400);
    const victim = human(2, 2, 3, 5);
    const hit = hitOf(strikeWithFury(attacker, victim, false));
    expect(hit).toMatchObject({ killed: true });
    expect(hit).not.toHaveProperty("fatality");
    expect(attacker.executedVictimIds()).toEqual([]);
    expect(victim.executed).toBe(false);
  });

  it("does not happen when the blow is under four times the victim's hit points", () => {
    // 30 strength: three points a swing, five with the rage; the victim has two hit points.
    const attacker = human(1, 1, 50, 5, 30);
    const victim = human(2, 2, 2, 5);
    const hit = hitOf(strikeWithFury(attacker, victim, true));
    expect(hit).toMatchObject({ killed: true });
    expect(hit).not.toHaveProperty("fatality");
  });

  it("does not happen on a blow that leaves the victim standing", () => {
    const attacker = human(1, 1, 50, 5, 400);
    const victim = human(2, 2, 100_000, 5);
    expect(hitOf(strikeWithFury(attacker, victim, true))).toMatchObject({ killed: false });
    expect(attacker.executedVictimIds()).toEqual([]);
  });
});

describe("the level gate of an execution", () => {
  const base = {
    furyFill: 100,
    killed: true,
    rawDamage: 100,
    hpBefore: 10,
    chance: 1,
    random: new FixedRandom(),
  };

  it("lets a player strike one up to ten levels above him, and a mob one level above", () => {
    expect(
      isExecution({ ...base, attacker: { level: 12 }, target: { level: 2, fighterKind: "human" } }),
    ).toBe(true);
    expect(
      isExecution({ ...base, attacker: { level: 12 }, target: { level: 1, fighterKind: "human" } }),
    ).toBe(false);
    expect(
      isExecution({ ...base, attacker: { level: 12 }, target: { level: 11, fighterKind: "bot" } }),
    ).toBe(true);
    expect(
      isExecution({ ...base, attacker: { level: 12 }, target: { level: 10, fighterKind: "bot" } }),
    ).toBe(false);
  });
});

describe("the chance of an execution", () => {
  const base = {
    furyFill: 100,
    killed: true,
    rawDamage: 100,
    hpBefore: 10,
    attacker: { level: 5 },
    target: { level: 5, fighterKind: "human" as const },
  };

  it("lets the conditions through only when the roll is under the chance", () => {
    expect(isExecution({ ...base, chance: 0.5, random: new FixedRandom(0.49) })).toBe(true);
    expect(isExecution({ ...base, chance: 0.5, random: new FixedRandom(0.5) })).toBe(false);
  });

  it("shrinks with the rage the button carried: half a scale, half the chance", () => {
    const half = { ...base, furyFill: 50, chance: 0.5 };
    expect(isExecution({ ...half, random: new FixedRandom(0.24) })).toBe(true);
    expect(isExecution({ ...half, random: new FixedRandom(0.26) })).toBe(false);
    const little = { ...base, furyFill: 4, chance: 0.5 };
    expect(isExecution({ ...little, random: new FixedRandom(0.019) })).toBe(true);
    expect(isExecution({ ...little, random: new FixedRandom(0.03) })).toBe(false);
  });

  it("never rolls when a condition fails", () => {
    const rolls: number[] = [];
    const random = { integer: () => 0, unit: () => (rolls.push(1), 0) };
    isExecution({ ...base, furyFill: null, chance: 0.5, random });
    isExecution({ ...base, rawDamage: 1, chance: 0.5, random });
    expect(rolls).toEqual([]);
  });
});
