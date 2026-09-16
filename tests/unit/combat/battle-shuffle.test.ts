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
    heroStrength: 10,
    botStrength: 10,
    ...UNIT_HUNT_BATTLE_STATS,
    botArtikulId: 2,
    botFightId: 1_000_000,
    botNick: "Грызль",
    botLevel: 1,
    ...GRYZL_FIGHT_LOOK,
    playerHp: 27,
    playerMaxHp: 27,
    botMaxHp: 50,
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

describe("Battle 3↔3 shuffle", () => {
  it("hands the bot to a waiter without changing HP", () => {
    const battle = new Battle(
      huntInit(),
      UNIT_BATTLE_RULES,
      new SequenceRandom([1, 1, 1, 1, 1, 1]),
    );
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman({
      accountId: 2,
      heroId: 2,
      nick: "Joiner",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      ...unitHuntHumanStats(10),
      team: 1,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    battle.authenticate(2, AUTH_NOW);
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      const bot = battle.resolveBotMelee(1);
      expect(bot.killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    const actorHp = 24;
    expect(battle.tryShuffleAfterHits(1)).toMatchObject({
      kind: "waiter-handoff",
      actorAccountId: 1,
      waiterAccountId: 2,
      waiterAuthed: true,
    });
    expect(battle.pairedAccountId).toBe(2);
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
    const outcome = battle.outcome("win", 1);
    const actor = outcome.humans.find((human) => human.accountId === 1);
    const waiter = outcome.humans.find((human) => human.accountId === 2);
    if (!actor || !waiter) throw new Error("Expected both hunters in the outcome");
    expect(actor.hp).toBe(actorHp);
    expect(waiter.hp).toBe(27);
  });

  it("keeps 3↔3 until a waiter joins and hands the bot after the next player hit", () => {
    const battle = new Battle(
      huntInit(),
      UNIT_BATTLE_RULES,
      new SequenceRandom([1, 1, 1, 1, 1, 1, 1]),
    );
    battle.authenticate(1, AUTH_NOW);
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      battle.resolveBotMelee(1);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    expect(battle.tryShuffleAfterHits(1)).toEqual({ kind: "none" });
    expect(battle.pairedAccountId).toBe(1);
    battle.addHuman({
      accountId: 2,
      heroId: 2,
      nick: "Joiner",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      ...unitHuntHumanStats(10),
      team: 1,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    battle.authenticate(2, AUTH_NOW);
    battle.grantTurn(1, AUTH_NOW);
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
    expect(battle.tryShuffleAfterHits(1)).toMatchObject({
      kind: "waiter-handoff",
      actorAccountId: 1,
      waiterAccountId: 2,
    });
    expect(battle.pairedAccountId).toBe(2);
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
  });

  it("cross-swaps two 3↔3 human↔bot duels without changing HP", () => {
    const battle = new Battle(
      huntInit(),
      UNIT_BATTLE_RULES,
      new SequenceRandom([0.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    );
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman({
      accountId: 2,
      heroId: 2,
      nick: "Joiner",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      ...unitHuntHumanStats(10),
      team: 1,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    battle.authenticate(2, AUTH_NOW);
    expect(battle.tryAggro(1, () => 1_000_001).kind).toBe("resolved");
    battle.grantTurn(2, AUTH_NOW);
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(1, "center", AUTH_NOW).kind).toBe("resolved");
      expect(battle.resolveBotMelee(1).killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(1, AUTH_NOW);
    }
    expect(battle.tryShuffleAfterHits(1)).toEqual({ kind: "none" });
    for (let round = 0; round < 3; round += 1) {
      expect(battle.tryPlayerMelee(2, "center", AUTH_NOW).kind).toBe("resolved");
      expect(battle.resolveBotMelee(2).killedPlayer).toBe(false);
      if (round < 2) battle.grantTurn(2, AUTH_NOW);
    }
    const leftHp = battle.outcome("win", 1).humans.find((human) => human.accountId === 1)?.hp;
    const rightHp = battle.outcome("win", 1).humans.find((human) => human.accountId === 2)?.hp;
    const leftBot = battle.foeBotSnap(1).id;
    const rightBot = battle.foeBotSnap(2).id;
    expect(battle.tryShuffleAfterHits(2)).toMatchObject({
      kind: "cross-swap",
      leftAccountId: 2,
      rightAccountId: 1,
    });
    expect(battle.foeBotSnap(1).id).toBe(rightBot);
    expect(battle.foeBotSnap(2).id).toBe(leftBot);
    expect(battle.foeBotSnap(1).id).not.toBe(battle.foeBotSnap(2).id);
    expect(battle.humanOpensDuel(1)).toBe(true);
    expect(battle.humanOpensDuel(2)).toBe(true);
    const after = battle.outcome("win", 1);
    expect(after.humans.find((human) => human.accountId === 1)?.hp).toBe(leftHp);
    expect(after.humans.find((human) => human.accountId === 2)?.hp).toBe(rightHp);
    expect(leftHp).toBe(24);
    expect(rightHp).toBe(24);
  });
});
