import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  tryPairedMelee,
  applyDamageToMeleeTarget,
} from "../../../src/modules/combat/domain/paired-melee.ts";
import {
  NO_STRIKE_MODS,
  strikeModsOfOverlay,
} from "../../../src/modules/combat/domain/strike-mods.ts";
import { schoolOverlayFromKind1 } from "../../../src/modules/combat/domain/school-overlay.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import {
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
  unitRosterBot,
} from "../../support/hunt-start-input.ts";

function fighter(heroId: number, team: 1 | 2, hp: number, strength = 10): HumanFighter {
  const human = new HumanFighter({
    accountId: heroId,
    heroId,
    nick: `H${heroId}`,
    level: 1,
    kind: 1,
    hp,
    maxHp: hp,
    mp: 10,
    maxMp: 10,
    team,
    waiting: false,
    ...unitHuntHumanStats(strength),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

describe("tryPairedMelee", () => {
  it("gives the win to the swinger whose hit killed the last foe even when ANTIVAMP kills him too", () => {
    const attacker = fighter(1, 1, 2);
    attacker.beginTurn(0, 20);
    attacker.effects.attachChargingKind3({
      strike: { ...NO_STRIKE_MODS, drain: { healPct: 0, hurtPct: 1000 } },
      sourceId: 1,
      artikulId: 1,
      title: "t",
      img: "i.png",
      dmgType: 1,
      remainTurns: 1,
    });
    const defender = fighter(2, 2, 1);
    const resolved = tryPairedMelee(attacker, defender, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker, defender],
      bots: [],
      nowMs: 0,
    });
    expect(attacker.hp).toBe(0);
    expect(defender.hp).toBe(0);
    expect(resolved.finished).toBe(true);
    expect(resolved.result).toMatchObject({ kind: "resolved" });
    const events = resolved.result.kind === "resolved" ? resolved.result.events : [];
    expect(events.find((event) => event.type === "finished")).toMatchObject({ winnerTeam: 1 });
    expect(events.filter((event) => event.type === "damage")).toMatchObject([
      { targetId: 2, killed: true },
      { targetId: 1, killed: true },
    ]);
  });

  it("hits the paired human and does not credit bot damage", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 27);
    const resolved = tryPairedMelee(attacker, defender, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker, defender],
      bots: [],
      nowMs: 0,
    });
    expect(resolved).toMatchObject({
      finished: false,
      result: {
        kind: "resolved",
        events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, targetId: 2, hpChange: -1 }],
      },
    });
    expect(attacker.damageToBot).toBe(0);
    expect(attacker.damageToHumans).toBe(1);
    expect(defender.hp).toBe(26);
  });

  it("does not finish when a living bot remains on the defender's team", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 1);
    const resolved = tryPairedMelee(attacker, defender, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker, defender],
      bots: [unitRosterBot({ hp: 10 })],
      nowMs: 0,
    });
    expect(resolved.finished).toBe(false);
    expect(resolved.result.kind).toBe("resolved");
    if (resolved.result.kind !== "resolved") throw new Error("expected resolved melee");
    expect(resolved.result.events.some((event) => event.type === "finished")).toBe(false);
    expect(defender.hp).toBe(0);
  });

  it("credits applied human HP-loss and ignores overkill past current HP", () => {
    const attacker = fighter(1, 1, 27);
    const defender = fighter(2, 2, 3);
    applyDamageToMeleeTarget(attacker, defender, 10, [attacker, defender]);
    expect(attacker.damageToHumans).toBe(3);
    expect(defender.hp).toBe(0);
  });

  it("sends hpChange equal to remaining HP on a killing blow", () => {
    const attacker = fighter(1, 1, 27, 80);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 3, 80);
    const resolved = tryPairedMelee(attacker, defender, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([8]),
      fightId: "8",
      humans: [attacker, defender],
      bots: [],
      nowMs: 0,
    });
    expect(resolved.finished).toBe(true);
    expect(resolved.result).toMatchObject({
      kind: "resolved",
      events: [
        { type: "turn-wait" },
        { type: "damage", sourceId: 1, targetId: 2, hpChange: -3, killed: true },
        { type: "finished", winnerTeam: 1 },
      ],
    });
    expect(defender.hp).toBe(0);
    expect(attacker.damageToHumans).toBe(3);
  });

  it("fails before ending the turn when the pair target is dead", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 1);
    defender.applyDamage(1);
    expect(() =>
      tryPairedMelee(attacker, defender, "center", {
        finished: false,
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([1]),
        fightId: "8",
        humans: [attacker, defender],
        bots: [],
        nowMs: 0,
      }),
    ).toThrow(/not a living paired opponent/);
    expect(attacker.turnActive).toBe(true);
  });

  it("mutates the live hunt bot and credits applied HP-loss", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const bot = unitRosterBot({ hp: 20 });
    const resolved = tryPairedMelee(attacker, bot, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker],
      bots: [bot],
      nowMs: 0,
    });
    expect(resolved.finished).toBe(false);
    expect(bot.hp).toBe(19);
    expect(attacker.damageToBot).toBe(1);
    expect(attacker.damageToHumans).toBe(0);
  });

  it("does not apply overlay after a killing physical hit", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const overlay = schoolOverlayFromKind1(
      {
        animData: "magic_baf",
        effects: [
          {
            kind: 1,
            dmgType: 64,
            charging: 1,
            skills: [{ skillId: "pcSTR", value: -84 }],
          },
        ],
      },
      15,
    );
    if (!overlay) throw new Error("Expected an overlay");
    attacker.effects.attachChargingKind3({
      strike: strikeModsOfOverlay(overlay),
      sourceId: 1,
      artikulId: 397,
      title: "Смертельное прикосновение",
      img: "hissa_magic1.png",
      dmgType: 64,
      remainTurns: 1,
    });
    const bot = unitRosterBot({ hp: 1 });
    const resolved = tryPairedMelee(attacker, bot, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker],
      bots: [bot],
      nowMs: 0,
    });
    expect(bot.hp).toBe(0);
    expect(attacker.damageToBot).toBe(1);
    expect(attacker.effects.snapshot()).toHaveLength(1);
    expect(resolved.finished).toBe(true);
  });

  it("throws when the melee bot is missing from the roster list", () => {
    const attacker = fighter(1, 1, 27);
    const bot = unitRosterBot();
    expect(() => applyDamageToMeleeTarget(attacker, bot, 1, [attacker])).toThrow(
      /missing from the roster/,
    );
    expect(bot.hp).toBe(20);
  });

  it("rejects non-positive melee damage without mutating the bot", () => {
    const attacker = fighter(1, 1, 27);
    const bot = unitRosterBot();
    expect(() => applyDamageToMeleeTarget(attacker, bot, 0, [attacker, bot])).toThrow(
      /positive integer/,
    );
    expect(bot.hp).toBe(20);
  });
});
