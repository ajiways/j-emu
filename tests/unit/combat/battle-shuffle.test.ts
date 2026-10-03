import { resolveBotMelee } from "../../support/ai-turn.ts";
import { describe, expect, it } from "vitest";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { unitHuntHumanStats } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function huntInit(overrides: Parameters<typeof unitHuntFightSetup>[0] = {}) {
  return unitHuntFightSetup({
    heroStrength: 10,
    botStrength: 10,
    botMaxHp: 50,
    ...overrides,
  });
}

function joinTeam1() {
  return unitFightJoin({ ...unitHuntHumanStats(10) });
}

describe("Battle 3↔3 shuffle", () => {
  it("hands the bot to a waiter without changing HP", () => {
    const battle = createUnitBattle(huntInit(), new SequenceRandom([1, 1, 1, 1, 1, 1]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      const bot = resolveBotMelee(battle, 1, AUTH_NOW);
      expect(bot.killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    const actorHp = 24;
    expect(battle.tryShuffleAfterHits(1)).toMatchObject({
      kind: "waiter-handoff",
      tells: [
        { accountId: 1, events: [{ type: "opponent-wait" }] },
        { accountId: 2, events: [{ type: "opponent-new" }] },
      ],
      starts: [2],
    });
    expect(battle.pairedOpponent(2)).toEqual({ kind: "bot" });
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
    const outcome = battle.outcome("win", 1);
    const actor = outcome.humans.find((human) => human.accountId === 1);
    const waiter = outcome.humans.find((human) => human.accountId === 2);
    if (!actor || !waiter) throw new Error("Expected both hunters in the outcome");
    expect(actor.hp).toBe(actorHp);
    expect(waiter.hp).toBe(27);
  });

  it("keeps 3↔3 until a waiter joins and hands the bot after the next player hit", () => {
    const battle = createUnitBattle(huntInit(), new SequenceRandom([1, 1, 1, 1, 1, 1, 1]));
    battle.authenticate(1, AUTH_NOW);
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      resolveBotMelee(battle, 1, AUTH_NOW);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    expect(battle.tryShuffleAfterHits(1)).toEqual({ kind: "none" });
    expect(battle.pairedOpponent(1)).toEqual({ kind: "bot" });
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    battle.grantTurn(1, AUTH_NOW);
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
    expect(battle.tryShuffleAfterHits(1)).toMatchObject({
      kind: "waiter-handoff",
      starts: [2],
    });
    expect(battle.pairedOpponent(2)).toEqual({ kind: "bot" });
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
  });

  it("cross-swaps two 3↔3 human↔bot duels without changing HP", () => {
    const battle = createUnitBattle(
      huntInit(),
      new SequenceRandom([0.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    );
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
    battle.grantTurn(2, AUTH_NOW);
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      expect(resolveBotMelee(battle, 1, AUTH_NOW).killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    expect(battle.tryShuffleAfterHits(1)).toEqual({ kind: "none" });
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(2, "center", AUTH_NOW).kind).toBe("resolved");
      expect(resolveBotMelee(battle, 2, AUTH_NOW).killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(2, AUTH_NOW);
    }
    const leftHp = battle.outcome("win", 1).humans.find((human) => human.accountId === 1)?.hp;
    const rightHp = battle.outcome("win", 1).humans.find((human) => human.accountId === 2)?.hp;
    const leftBot = battle.foeBotSnap(1).id;
    const rightBot = battle.foeBotSnap(2).id;
    expect(battle.tryShuffleAfterHits(2)).toMatchObject({
      kind: "cross-swap",
      tells: [
        { accountId: 2, events: [{ type: "opponent-new" }] },
        { accountId: 1, events: [{ type: "opponent-new" }] },
      ],
      starts: [2, 1],
    });
    expect(battle.foeBotSnap(1).id).toBe(rightBot);
    expect(battle.foeBotSnap(2).id).toBe(leftBot);
    expect(battle.foeBotSnap(1).id).not.toBe(battle.foeBotSnap(2).id);
    expect(battle.nextActorIdOf(1)).toBe(battle.heroIdFor(1));
    expect(battle.nextActorIdOf(2)).toBe(battle.heroIdFor(2));
    const after = battle.outcome("win", 1);
    expect(after.humans.find((human) => human.accountId === 1)?.hp).toBe(leftHp);
    expect(after.humans.find((human) => human.accountId === 2)?.hp).toBe(rightHp);
    expect(leftHp).toBe(24);
    expect(rightHp).toBe(24);
  });
});

describe("Battle wire audience", () => {
  it("stops addressing a player who left the fight", () => {
    const battle = createUnitBattle(huntInit(), new SequenceRandom([1]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    expect(battle.authedAccountIds()).toEqual([1, 2]);
    battle.markHumanLeft(1);
    expect(battle.authedAccountIds()).toEqual([2]);
  });
});
