import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import type { HuntBattleInit } from "../../../src/modules/combat/domain/hunt-battle-init.ts";
import { GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

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
    startedAt: new Date("2026-09-07T12:00:00.000Z"),
    ...overrides,
  };
}

function createBattle(random: SequenceRandom, overrides: Partial<HuntBattleInit> = {}): Battle {
  return new Battle(
    huntInit(overrides),
    {
      playerDamageMin: 8,
      playerDamageMax: 12,
      botDamageMin: 2,
      botDamageMax: 4,
      turnTimeoutSeconds: 20,
    },
    random,
  );
}

describe("Battle", () => {
  it("fails instead of accepting a strike before authentication", () => {
    const battle = createBattle(new SequenceRandom([8]));
    expect(() => battle.strike(1, "center")).toThrow(/not authenticated/);
  });

  it("uses the explicit rules and keeps packet order", () => {
    const battle = createBattle(new SequenceRandom([8, 2]));
    expect(battle.authenticate(1)).toEqual([
      {
        type: "hunt-bootstrap",
        waiting: false,
        hero: {
          id: 1,
          nick: "Hero",
          level: 1,
          kind: 1,
          hp: 27,
          maxHp: 27,
          mp: 10,
          maxMp: 10,
          team: 1,
        },
        allies: [],
        bot: {
          id: 1_000_000,
          nick: "Грызль",
          level: 1,
          hp: 20,
          maxHp: 20,
          artikulId: 2,
          avatar: "avatar_gryzl1_sm.jpg",
          sk: "11",
          body: "",
          team: 2,
        },
      },
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
    const events = battle.strike(1, "left");
    expect(events[0]).toMatchObject({
      type: "damage",
      sourceId: 1,
      targetId: 1_000_000,
      hpChange: -8,
      targetMaxHp: 20,
    });
    expect(events[1]).toMatchObject({
      type: "damage",
      sourceId: 1_000_000,
      targetId: 1,
      hpChange: -2,
      targetMaxHp: 27,
    });
    expect(events[2]).toEqual({ type: "turn-granted", timeoutSeconds: 20 });
  });

  it("rejects a bot fight id that collides with the hero", () => {
    expect(() => createBattle(new SequenceRandom([8]), { heroId: 1_000_000 })).toThrow(
      /collides with the human participant id/,
    );
  });

  it("queues a second human as waiting without attacknow", () => {
    const battle = createBattle(new SequenceRandom([8]));
    battle.authenticate(1);
    const roster = battle.addHuman({
      accountId: 2,
      heroId: 2,
      nick: "Joiner",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
    });
    expect(roster).toMatchObject({
      type: "roster-updated",
      joined: { id: 2, nick: "Joiner", team: 1 },
    });
    const bootstrap = battle.authenticate(2);
    expect(bootstrap).toEqual([
      {
        type: "hunt-bootstrap",
        waiting: true,
        hero: {
          id: 2,
          nick: "Joiner",
          level: 1,
          kind: 1,
          hp: 27,
          maxHp: 27,
          mp: 10,
          maxMp: 10,
          team: 1,
        },
        allies: [
          {
            id: 1,
            nick: "Hero",
            level: 1,
            kind: 1,
            hp: 27,
            maxHp: 27,
            mp: 10,
            maxMp: 10,
            team: 1,
          },
        ],
        bot: {
          id: 1_000_000,
          nick: "Грызль",
          level: 1,
          hp: 20,
          maxHp: 20,
          artikulId: 2,
          avatar: "avatar_gryzl1_sm.jpg",
          sk: "11",
          body: "",
          team: 2,
        },
      },
    ]);
    expect(() => battle.strike(2, "center")).toThrow(/Queued hunter cannot strike/);
  });
});
