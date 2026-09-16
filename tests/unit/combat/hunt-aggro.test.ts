import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { HuntBattleInit } from "../../../src/modules/combat/domain/hunt-battle-init.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  UNIT_HUNT_BATTLE_STATS,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function huntInit(overrides: Partial<HuntBattleInit> = {}): HuntBattleInit {
  return {
    fightId: "1",
    accessKey: "access-key",
    accountId: 1,
    heroId: 1,
    heroNick: "Hero",
    heroLevel: 1,
    heroKind: 1,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: 80,
    botStrength: 20,
    ...UNIT_HUNT_BATTLE_STATS,
    botArtikulId: 2,
    botFightId: 1_000_000,
    botNick: "Грызль",
    botLevel: 1,
    ...GRYZL_FIGHT_LOOK,
    playerHp: 27,
    playerMaxHp: 27,
    botMaxHp: 20,
    arena: "1_1",
    areaId: "503",
    instanceCopyId: null,
    startedAt: new Date("2026-09-07T12:00:00.000Z"),
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    purpose: "hunt",
    extraEnemies: [],
    allies: [],
    chatWin: "",
    chatLose: "",
    ...overrides,
  };
}

function joinTeam1() {
  return {
    accountId: 2,
    heroId: 2,
    nick: "Joiner",
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    ...unitHuntHumanStats(80),
    team: 1 as const,
    appearance: UNIT_HUNT_APPEARANCE,
    loadout: EMPTY_COMBAT_LOADOUT,
    startedAtMs: AUTH_NOW,
  };
}

describe("hunt aggro clone", () => {
  it("clones the paired enemy bot and pairs a waiting team-1 hunter", () => {
    const battle = new Battle(huntInit(), UNIT_BATTLE_RULES, new SequenceRandom([0.4]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman(joinTeam1());
    battle.authenticate(2, AUTH_NOW);
    expect(battle.livingHumans().find((human) => human.accountId === 2)?.waiting).toBe(true);
    const aggro = battle.tryAggro(1, () => 1_000_001);
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

  it("hands the clone after the current outdoor bot dies", () => {
    const battle = new Battle(
      huntInit({ botMaxHp: 8 }),
      UNIT_BATTLE_RULES,
      new SequenceRandom([8]),
    );
    battle.authenticate(1, AUTH_NOW);
    expect(battle.tryAggro(1, () => 1_000_001).kind).toBe("resolved");
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
    const battle = new Battle(
      huntInit({ heroStrength: 10, botStrength: 10, botMaxHp: 50 }),
      UNIT_BATTLE_RULES,
      new SequenceRandom([1, 1, 1, 1, 1, 1]),
    );
    battle.authenticate(1, AUTH_NOW);
    expect(battle.tryAggro(1, () => 1_000_001).kind).toBe("resolved");
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
    const quest = new Battle(
      huntInit({ purpose: "quest" }),
      UNIT_BATTLE_RULES,
      new SequenceRandom([0.4]),
    );
    quest.authenticate(1, AUTH_NOW);
    const quested = quest.tryAggro(1, () => 1_000_001);
    expect(quested).toMatchObject({
      kind: "resolved",
      pairedAccountIds: [],
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1 },
        { type: "native-count", srcId: 7, count: 1 },
      ],
    });
    const copy = new Battle(
      huntInit({ instanceCopyId: 7 }),
      UNIT_BATTLE_RULES,
      new SequenceRandom([0.4]),
    );
    copy.authenticate(1, AUTH_NOW);
    expect(copy.tryAggro(1, () => 1_000_001)).toMatchObject({
      kind: "resolved",
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1 },
        { type: "native-count", srcId: 7, count: 1 },
      ],
    });
    const empty = new Battle(
      huntInit({ heroAggroCharges: 0 }),
      UNIT_BATTLE_RULES,
      new SequenceRandom([0.4]),
    );
    empty.authenticate(1, AUTH_NOW);
    expect(empty.tryAggro(1, () => 1_000_001)).toMatchObject({
      kind: "resolved",
      events: [
        { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1 },
        { type: "native-count", srcId: 7, count: 0 },
      ],
    });
    expect(empty.livingHumans()).toHaveLength(1);
  });
});
