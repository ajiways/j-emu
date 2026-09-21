import { describe, expect, it } from "vitest";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function huntInit(overrides: Parameters<typeof unitHuntFightSetup>[0] = {}) {
  return unitHuntFightSetup(overrides);
}

function joinTeam1() {
  return unitFightJoin();
}

describe("hunt aggro clone", () => {
  it("clones the paired enemy bot and pairs a waiting team-1 hunter", () => {
    const battle = createUnitBattle(huntInit(), new SequenceRandom([0.4]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    expect(battle.livingHumans().find((human) => human.accountId === 2)?.waiting).toBe(true);
    const aggro = battle.tryAggro(1, 1_000_000, () => 1_000_001);
    expect(aggro.kind).toBe("resolved");
    if (aggro.kind !== "resolved") throw new Error("expected resolved aggro");
    expect(aggro.pairedAccountIds).toEqual([2]);
    expect(aggro.events.map((event) => event.type)).toEqual(["native-count", "roster-updated"]);
    expect(aggro.events[0]).toMatchObject({ type: "native-count", srcId: 7, count: 0 });
    const roster = aggro.events[1];
    if (!roster || roster.type !== "roster-updated") throw new Error("expected roster-updated");
    expect(roster.rosterBots).toHaveLength(2);
    expect(battle.livingHumans().find((human) => human.accountId === 2)?.waiting).toBe(false);
    expect(battle.pairedOpponent(1)).toEqual({ kind: "bot" });
    expect(battle.pairedOpponent(2)).toEqual({ kind: "bot" });
    expect(battle.foeBotSnap(1).id).toBe(1_000_000);
    expect(battle.foeBotSnap(2).id).toBe(1_000_001);
  });

  it("puts the killer in oppwait when the other hunter still has a live bot", () => {
    const battle = createUnitBattle(huntInit({ botMaxHp: 8 }), new SequenceRandom([0.4, 8]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
    const melee = battle.tryPlayerMelee(1, "center", AUTH_NOW);
    expect(melee.kind).toBe("resolved");
    if (melee.kind !== "resolved") throw new Error("expected resolved melee");
    expect(melee.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "damage", killed: true, targetId: 1_000_000 }),
        { type: "opponent-wait" },
      ]),
    );
    expect(melee.events.some((event) => event.type === "finished")).toBe(false);
    expect(battle.finished).toBe(false);
    expect(battle.livingHumans().find((human) => human.accountId === 1)?.waiting).toBe(true);
    expect(battle.pairedOpponent(2)).toEqual({ kind: "bot" });
  });

  it("bootstraps the clone as the joiner foe when fight-auth is after pairing", () => {
    const battle = createUnitBattle(huntInit(), new SequenceRandom([0.4]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
    const boot = battle.authenticate(2, AUTH_NOW);
    expect(boot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hunt-bootstrap",
          waiting: false,
          bot: expect.objectContaining({ id: 1_000_001 }),
        }),
        expect.objectContaining({ type: "turn-granted", timeoutSeconds: 20 }),
      ]),
    );
  });

  it("hands the clone after the current outdoor bot dies", () => {
    const battle = createUnitBattle(huntInit({ botMaxHp: 8 }), new SequenceRandom([8]));
    battle.authenticate(1, AUTH_NOW);
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
    expect(battle.bots.map((bot) => bot.fightId)).toEqual([1_000_000, 1_000_001]);
    expect(battle.bots.find((bot) => bot.fightId === 1_000_001)?.waiting).toBe(true);
    expect(battle.foeBotSnap(1).id).toBe(1_000_000);
    const melee = battle.tryPlayerMelee(1, "center", AUTH_NOW);
    expect(melee.kind).toBe("resolved");
    if (melee.kind !== "resolved") throw new Error("expected resolved melee");
    expect(melee.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "damage", killed: true, targetId: 1_000_000 }),
        expect.objectContaining({
          type: "opponent-new",
          bot: expect.objectContaining({ id: 1_000_001, hp: 8, maxHp: 8 }),
        }),
      ]),
    );
    expect(battle.finished).toBe(false);
    expect(battle.foeBotSnap(1).id).toBe(1_000_001);
  });

  it("swaps to the waiting clone after 3↔3 hits", () => {
    const battle = createUnitBattle(
      huntInit({ heroStrength: 10, botStrength: 10, botMaxHp: 50 }),
      new SequenceRandom([1, 1, 1, 1, 1, 1]),
    );
    battle.authenticate(1, AUTH_NOW);
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      expect(battle.resolveBotMelee(1).killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    expect(battle.tryShuffleAfterHits(1)).toMatchObject({
      kind: "reserve-swap",
      accountId: 1,
      bot: { id: 1_000_001 },
    });
    expect(battle.finished).toBe(false);
    expect(battle.foeBotSnap(1).id).toBe(1_000_001);
    expect(battle.foeBotSnap(1).hp).toBe(50);
  });

  it("denies quest, copy, and zero-charge outdoor without spending", () => {
    const quest = createUnitBattle(huntInit({ purpose: "quest" }), new SequenceRandom([0.4]));
    quest.authenticate(1, AUTH_NOW);
    const quested = quest.tryAggro(1, 1_000_000, () => 1_000_001);
    expect(quested).toMatchObject({
      kind: "resolved",
      pairedAccountIds: [],
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1 },
        { type: "native-count", srcId: 7, count: 1 },
      ],
    });
    const copy = createUnitBattle(huntInit({ instanceCopyId: 7 }), new SequenceRandom([0.4]));
    copy.authenticate(1, AUTH_NOW);
    expect(copy.tryAggro(1, 1_000_000, () => 1_000_001)).toMatchObject({
      kind: "resolved",
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1 },
        { type: "native-count", srcId: 7, count: 1 },
      ],
    });
    const empty = createUnitBattle(huntInit({ heroAggroCharges: 0 }), new SequenceRandom([0.4]));
    empty.authenticate(1, AUTH_NOW);
    expect(empty.tryAggro(1, 1_000_000, () => 1_000_001)).toMatchObject({
      kind: "resolved",
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1 },
        { type: "native-count", srcId: 7, count: 0 },
      ],
    });
    expect(empty.livingHumans()).toHaveLength(1);
  });

  it("lets a waiting joiner spend their own charge on the opener bot", () => {
    const battle = createUnitBattle(huntInit(), new SequenceRandom([0.4, 0.4]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    expect(battle.livingHumans().find((human) => human.accountId === 2)?.waiting).toBe(true);
    const denied = battle.tryAggro(2, 1_000_099, () => 1_000_001);
    expect(denied).toMatchObject({
      kind: "resolved",
      pairedAccountIds: [],
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 2, targetId: 2 },
        { type: "native-count", srcId: 7, count: 1 },
      ],
    });
    const aggro = battle.tryAggro(2, 1_000_000, () => 1_000_001);
    expect(aggro.kind).toBe("resolved");
    if (aggro.kind !== "resolved") throw new Error("expected resolved joiner aggro");
    expect(aggro.pairedAccountIds).toEqual([2]);
    expect(aggro.events[0]).toMatchObject({ type: "native-count", srcId: 7, count: 0 });
    expect(battle.livingHumans().find((human) => human.accountId === 2)?.waiting).toBe(false);
    expect(battle.livingHumans().find((human) => human.accountId === 1)?.casts.aggro).toBe(1);
    expect(battle.foeBotSnap(1).id).toBe(1_000_000);
    expect(battle.foeBotSnap(2).id).toBe(1_000_001);
    const opener = battle.tryAggro(1, 1_000_000, () => 1_000_002);
    expect(opener.kind).toBe("resolved");
    if (opener.kind !== "resolved") throw new Error("expected resolved opener aggro");
    expect(opener.events[0]).toMatchObject({ type: "native-count", srcId: 7, count: 0 });
    expect(battle.livingHumans().find((human) => human.accountId === 1)?.casts.aggro).toBe(0);
  });
});
