import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { tryPairedMelee } from "../../../src/modules/combat/domain/paired-melee.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

function fighter(heroId: number, team: 1 | 2, hp: number): HuntHuman {
  const human = new HuntHuman({
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
    strength: 10,
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: null,
  });
  human.authed = true;
  return human;
}

describe("tryPairedMelee", () => {
  it("hits the paired human and does not credit bot damage", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 27);
    const resolved = tryPairedMelee(attacker, { kind: "human", human: defender }, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker, defender],
      bot: null,
      nowMs: 0,
    });
    expect(resolved).toMatchObject({
      botHp: null,
      finished: false,
      result: {
        kind: "resolved",
        events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, targetId: 2, hpChange: -1 }],
      },
    });
    expect(attacker.damageToBot).toBe(0);
    expect(defender.hp).toBe(26);
  });

  it("does not finish when a living bot remains on the defender's team", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 1);
    const resolved = tryPairedMelee(attacker, { kind: "human", human: defender }, "center", {
      finished: false,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([1]),
      fightId: "8",
      humans: [attacker, defender],
      bot: { fightId: 1_000_000, hp: 10, maxHp: 10, team: 2 },
      nowMs: 0,
    });
    expect(resolved.finished).toBe(false);
    expect(resolved.result.kind).toBe("resolved");
    if (resolved.result.kind !== "resolved") throw new Error("expected resolved melee");
    expect(resolved.result.events.some((event) => event.type === "finished")).toBe(false);
    expect(defender.hp).toBe(0);
  });

  it("fails before ending the turn when the pair target is dead", () => {
    const attacker = fighter(1, 1, 27);
    attacker.beginTurn(0, 20);
    const defender = fighter(2, 2, 1);
    defender.applyDamage(1);
    expect(() =>
      tryPairedMelee(attacker, { kind: "human", human: defender }, "center", {
        finished: false,
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([1]),
        fightId: "8",
        humans: [attacker, defender],
        bot: null,
        nowMs: 0,
      }),
    ).toThrow(/not a living paired opponent/);
    expect(attacker.turnActive).toBe(true);
  });
});
