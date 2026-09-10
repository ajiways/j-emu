import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { HuntBattleInit } from "../../../src/modules/combat/domain/hunt-battle-init.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";
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
    heroStrength: 80,
    botStrength: 20,
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
    loadout: EMPTY_COMBAT_LOADOUT,
    botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    ...overrides,
  };
}

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function createBattle(random: SequenceRandom, overrides: Partial<HuntBattleInit> = {}): Battle {
  return new Battle(huntInit(overrides), UNIT_BATTLE_RULES, random);
}

describe("Battle", () => {
  it("fails instead of accepting a strike before authentication", () => {
    const battle = createBattle(new SequenceRandom([8]));
    expect(() => battle.tryPlayerMelee(1, "center")).toThrow(/not authenticated/);
  });

  it("resolves player melee without a bot hit or turn grant", () => {
    const battle = createBattle(new SequenceRandom([8, 2]));
    expect(battle.authenticate(1, AUTH_NOW)).toEqual([
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
        cp: 0,
        cpHits: [],
        rage: 0,
        aggro: 1,
        loadout: EMPTY_COMBAT_LOADOUT,
      },
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
    const resolved = battle.tryPlayerMelee(1, "left");
    expect(resolved).toMatchObject({
      kind: "resolved",
      events: [
        { type: "turn-wait", timeoutSeconds: 20 },
        {
          type: "damage",
          sourceId: 1,
          targetId: 1_000_000,
          animation: "attack_left",
          hpChange: -8,
          targetMaxHp: 20,
          killed: false,
        },
      ],
    });
    expect(battle.tryPlayerMelee(1, "center")).toEqual({ kind: "ignored" });
    const bot = battle.resolveBotMelee();
    expect(bot.events[0]).toMatchObject({
      type: "damage",
      sourceId: 1_000_000,
      targetId: 1,
      hpChange: -2,
      targetMaxHp: 27,
    });
    expect(battle.grantTurn(1, AUTH_NOW)).toEqual({ type: "turn-granted", timeoutSeconds: 20 });
  });

  it("casts magic_direct from a Hissa book instead of melee", () => {
    const battle = createBattle(new SequenceRandom([8, 0.95, 1]), {
      botArtikulId: 4,
      botNick: "Хисса",
      botStrength: 15,
      botSpellBook: {
        nothingWeight: 100,
        spells: [
          {
            artikulId: 396,
            slot: "turn_roulette",
            weight: 10,
            maxCasts: null,
            gate: null,
            hpPct: null,
            spell: {
              animData: "magic_direct",
              endTurn: true,
              effects: [{ kind: 1, skills: [{ skillId: "pcSTR", value: -50 }] }, { kind: 4 }],
            },
          },
        ],
      },
    });
    battle.authenticate(1, AUTH_NOW);
    battle.tryPlayerMelee(1, "left");
    const bot = battle.resolveBotMelee();
    expect(bot.events[0]).toMatchObject({
      type: "damage",
      animation: "magic_direct",
      hpChange: -1,
      sourceId: 1_000_000,
      targetId: 1,
    });
  });

  it("rejects a bot fight id that collides with the hero", () => {
    expect(() => createBattle(new SequenceRandom([8]), { heroId: 1_000_000 })).toThrow(
      /collides with the human participant id/,
    );
  });

  it("queues a second human as waiting without attacknow", () => {
    const battle = createBattle(new SequenceRandom([8]));
    battle.authenticate(1, AUTH_NOW);
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
      strength: 80,
      loadout: EMPTY_COMBAT_LOADOUT,
    });
    expect(roster).toMatchObject({
      type: "roster-updated",
      joined: { id: 2, nick: "Joiner", team: 1 },
    });
    const bootstrap = battle.authenticate(2, AUTH_NOW);
    expect(bootstrap[0]).toMatchObject({ type: "hunt-bootstrap", waiting: true });
    expect(bootstrap.some((event) => event.type === "turn-granted")).toBe(false);
    expect(battle.tryPlayerMelee(2, "center")).toEqual({ kind: "ignored" });
    const hit = battle.tryPlayerMelee(1, "left");
    expect(hit).toMatchObject({
      kind: "resolved",
      events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, targetId: 1_000_000 }],
    });
    expect(battle.pairedOpponent(1)).toEqual({ kind: "bot" });
  });

  it("resumes a paired hunter without resetting the turn deadline", () => {
    const battle = createBattle(new SequenceRandom([8]));
    battle.authenticate(1, AUTH_NOW);
    battle.prepareResume(1);
    const events = battle.authenticate(1, AUTH_NOW + 3_000);
    expect(events[0]).toMatchObject({
      type: "hunt-bootstrap",
      waiting: false,
      resumePaired: true,
    });
    expect(events).toContainEqual({ type: "turn-granted", timeoutSeconds: 17 });
  });
});
