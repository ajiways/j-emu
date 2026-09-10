import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { FriendlyDuelBattleInit } from "../../../src/modules/combat/domain/friendly-duel-battle-init.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function fighter(
  accountId: number,
  heroId: number,
  nick: string,
): FriendlyDuelBattleInit["challenger"] {
  return {
    accountId,
    heroId,
    nick,
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    strength: 10,
    loadout: EMPTY_COMBAT_LOADOUT,
    avatar: "avatar_small.jpg",
    body: "m1",
    sk: "1",
  };
}

function duelInit(): FriendlyDuelBattleInit {
  return {
    kind: "friendly-duel",
    fightId: "8",
    accessKey: "duel-key",
    arena: "1_1",
    areaId: "503",
    startedAt: new Date("2026-09-07T12:00:00.000Z"),
    challenger: fighter(1, 1, "A"),
    acceptor: fighter(2, 2, "B"),
  };
}

describe("friendly duel Battle", () => {
  it("lets the challenger strike the acceptor and finishes without a bot", () => {
    const battle = new Battle(duelInit(), UNIT_BATTLE_RULES, new SequenceRandom([1, 1, 1]));
    const opener = battle.authenticate(1, AUTH_NOW);
    expect(opener[0]).toMatchObject({
      type: "friendly-bootstrap",
      hero: { id: 1, team: 1 },
      opponent: { id: 2, team: 2 },
    });
    expect(opener.some((event) => event.type === "turn-granted")).toBe(true);
    const waiting = battle.authenticate(2, AUTH_NOW);
    expect(waiting.some((event) => event.type === "turn-granted")).toBe(false);
    const hit = battle.tryPlayerMelee(1, "center");
    expect(hit).toMatchObject({
      kind: "resolved",
      events: [
        { type: "turn-wait", timeoutSeconds: 20 },
        { type: "damage", sourceId: 1, targetId: 2, hpChange: -1, killed: false },
      ],
    });
    expect(battle.tryPlayerMelee(1, "center")).toEqual({ kind: "ignored" });
    battle.grantTurn(2, AUTH_NOW);
    expect(battle.tryPlayerMelee(2, "left").kind).toBe("resolved");
    expect(battle.pairedOpponent(1)).toEqual({ kind: "human", accountId: 2 });
    expect(() => battle.resolveBotMelee()).toThrow(/no bot to take a turn/);
  });
});
