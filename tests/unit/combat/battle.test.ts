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

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function createBattle(random: SequenceRandom, overrides: Partial<HuntBattleInit> = {}): Battle {
  return new Battle(huntInit(overrides), UNIT_BATTLE_RULES, random);
}

describe("Battle", () => {
  it("fails instead of accepting a strike before authentication", () => {
    const battle = createBattle(new SequenceRandom([8]));
    expect(() => battle.tryPlayerMelee(1, "center", AUTH_NOW)).toThrow(/not authenticated/);
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
          dealtDamage: 0,
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
          dealtDamage: 0,
        },
        rosterBots: [
          {
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
            dealtDamage: 0,
          },
        ],
        cp: 0,
        cpHits: [],
        rage: 0,
        aggro: 1,
        loadout: EMPTY_COMBAT_LOADOUT,
        heroEffects: [],
        otherEffects: [],
      },
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
    const resolved = battle.tryPlayerMelee(1, "left", AUTH_NOW);
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
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
    const bot = battle.resolveBotMelee(1);
    expect(bot.events[0]).toMatchObject({
      type: "damage",
      sourceId: 1_000_000,
      targetId: 1,
      hpChange: -2,
      targetMaxHp: 27,
    });
    expect(battle.livingHumans()[0]?.dealtDamage).toBe(8);
    expect(battle.foeBotSnap(1).dealtDamage).toBe(2);
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
            title: "Ядовитый плевок",
            picture: "hissa_magic1.png",
            slot: "turn_roulette",
            weight: 10,
            maxCasts: null,
            gate: null,
            hpPct: null,
            spell: {
              animData: "magic_direct",
              groupId: 845,
              endTurn: true,
              effects: [
                { kind: 1, dmgType: 64, skills: [{ skillId: "pcSTR", value: -50 }] },
                { kind: 4, dmgType: 64, duration: 81 },
              ],
            },
          },
        ],
      },
    });
    battle.authenticate(1, AUTH_NOW);
    battle.tryPlayerMelee(1, "left", AUTH_NOW);
    const bot = battle.resolveBotMelee(1);
    expect(bot.events).toMatchObject([
      {
        type: "effect-use",
        artikulId: 396,
        kind: 4,
        img: "hissa_magic1.png",
        title: "Ядовитый плевок",
        groupId: 845,
        persId: 1,
        sourceId: 1_000_000,
        remainTime: 120,
      },
      {
        type: "damage",
        animation: "magic_direct",
        hpChange: -1,
        sourceId: 1_000_000,
        targetId: 1,
      },
    ]);
    expect(battle.livingHumans()[0]?.effects.snapshot()).toMatchObject([
      {
        artikulId: 396,
        kind: 4,
        img: "hissa_magic1.png",
        title: "Ядовитый плевок",
        groupId: 845,
        remainTime: 120,
      },
    ]);
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
      ...unitHuntHumanStats(80),
      team: 1,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    expect(roster).toMatchObject({
      type: "roster-updated",
      joined: { id: 2, nick: "Joiner", team: 1 },
    });
    const bootstrap = battle.authenticate(2, AUTH_NOW);
    expect(bootstrap[0]).toMatchObject({ type: "hunt-bootstrap", waiting: true });
    expect(bootstrap.some((event) => event.type === "turn-granted")).toBe(false);
    expect(battle.tryPlayerMelee(2, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
    const hit = battle.tryPlayerMelee(1, "left", AUTH_NOW);
    expect(hit).toMatchObject({
      kind: "resolved",
      events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, targetId: 1_000_000 }],
    });
    expect(battle.pairedOpponent(1)).toEqual({ kind: "bot" });
  });

  it("retargets a living team-2 waiter after the hunt bot dies", () => {
    const battle = createBattle(new SequenceRandom([20]), { heroStrength: 200 });
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman({
      accountId: 2,
      heroId: 2,
      nick: "Intervenor",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      ...unitHuntHumanStats(80),
      team: 2,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    battle.authenticate(2, AUTH_NOW);
    const hit = battle.tryPlayerMelee(1, "left", AUTH_NOW);
    if (hit.kind !== "resolved") throw new Error("Expected a resolved melee hit");
    expect(hit.events.some((event) => event.type === "finished")).toBe(false);
    const retarget = hit.events.find((event) => event.type === "opponent-new-human");
    expect(retarget).toMatchObject({
      type: "opponent-new-human",
      human: { id: 2, team: 2 },
      appearance: UNIT_HUNT_APPEARANCE,
    });
    expect(battle.finished).toBe(false);
    expect(battle.pairedOpponent(1)).toEqual({ kind: "human", accountId: 2 });
    expect(battle.tickRosterDuels().some((event) => event.type === "finished")).toBe(false);
  });

  it("pairs a team-2 joiner with a team-1 waiter while the opener stays on the bot", () => {
    const battle = createBattle(new SequenceRandom([0.4, 8]));
    battle.authenticate(1, AUTH_NOW);
    battle.addHuman({
      accountId: 2,
      heroId: 2,
      nick: "Waiter",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      ...unitHuntHumanStats(80),
      team: 1,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    battle.authenticate(2, AUTH_NOW);
    battle.addHuman({
      accountId: 3,
      heroId: 3,
      nick: "Intervenor",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      ...unitHuntHumanStats(80),
      team: 2,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    const bootstrap = battle.authenticate(3, AUTH_NOW);
    expect(bootstrap[0]).toMatchObject({
      type: "hunt-bootstrap",
      waiting: false,
      humanOpponent: { id: 2, team: 1 },
    });
    expect(bootstrap.some((event) => event.type === "turn-granted")).toBe(false);
    expect(battle.pairedOpponent(1)).toEqual({ kind: "bot" });
    expect(battle.pairedOpponent(2)).toEqual({ kind: "human", accountId: 3 });
    expect(battle.pairedOpponent(3)).toEqual({ kind: "human", accountId: 2 });
    const hit = battle.tryPlayerMelee(1, "left", AUTH_NOW);
    expect(hit).toMatchObject({
      kind: "resolved",
      events: [{ type: "turn-wait" }, { type: "damage", sourceId: 1, targetId: 1_000_000 }],
    });
    expect(battle.finished).toBe(false);
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

  it("gives the joiner the waiting clone after they kill their foe", () => {
    const battle = new Battle(
      huntInit({ heroStrength: 200, botMaxHp: 8, heroAggroCharges: 2 }),
      UNIT_BATTLE_RULES,
      {
        integer(minInclusive) {
          return minInclusive;
        },
        unit() {
          return 0.4;
        },
      },
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
      ...unitHuntHumanStats(200),
      team: 1,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      startedAtMs: AUTH_NOW,
    });
    battle.authenticate(2, AUTH_NOW);
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
    expect(battle.tryAggro(1, 1_000_000, () => 1_000_002).kind).toBe("resolved");
    battle.grantTurn(2, AUTH_NOW);
    const hit = battle.tryPlayerMelee(2, "center", AUTH_NOW);
    if (hit.kind !== "resolved") throw new Error("expected the joiner melee to resolve");
    expect(hit.events.some((event) => event.type === "damage" && event.killed)).toBe(true);
    const next = hit.events.find((event) => event.type === "opponent-new");
    expect(next).toMatchObject({ type: "opponent-new", bot: { id: 1_000_002 } });
    expect(battle.pairedOpponent(2)).toEqual({ kind: "bot" });
  });
});
