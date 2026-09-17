import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import type { CombatLoadout } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { HuntBattleInit } from "../../../src/modules/combat/domain/hunt-battle-init.ts";
import {
  aoeKind1Damage,
  gloveKind1IsAoe,
} from "../../../src/modules/combat/domain/glove-aoe-targets.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  UNIT_HUNT_BATTLE_STATS,
  unitHuntHumanStats,
  unitHuntJoin,
  unitHuntStart,
} from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

const aoeLoadout: CombatLoadout = {
  pocket: [],
  glove: {
    hits: [2, 3, 2, 3, 1, 2, 3, 1],
    spells: [
      {
        artikulId: 9098,
        cost: 2,
        row: 1,
        title: "Разряд молнии",
        picture: "electro_ball1.png",
        spell: {
          animData: "magic_electroball",
          endTurn: true,
          persRestr: { active: true, dead: false },
          targetRestr: { opp: true, dead: false },
          effects: [{ kind: 1, dmgType: 128 }],
        },
      },
      {
        artikulId: 9099,
        cost: 4,
        row: 1,
        title: "Волна света",
        picture: "ludoed_magic_light.png",
        spell: {
          animData: "magic_aoe_light",
          endTurn: true,
          persRestr: { active: true, dead: false },
          targetRestr: { opp: true, dead: false },
          effects: [{ kind: 1, targetCount: 2 }],
        },
      },
    ],
  },
  gearSpells: [],
};

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
    botMaxHp: 200,
    arena: "1_1",
    areaId: "503",
    instanceCopyId: null,
    startedAt: new Date("2026-09-07T12:00:00.000Z"),
    loadout: aoeLoadout,
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
    loadout: aoeLoadout,
    startedAtMs: AUTH_NOW,
  };
}

function pairedHunt(): Battle {
  const battle = new Battle(
    huntInit(),
    UNIT_BATTLE_RULES,
    new SequenceRandom([0.4, 8, 8, 8, 8, 8, 8]),
  );
  battle.authenticate(1, AUTH_NOW);
  battle.addHuman(joinTeam1());
  battle.authenticate(2, AUTH_NOW);
  expect(battle.tryAggro(1, () => 1_000_001).kind).toBe("resolved");
  return battle;
}

function buildFourCombo(battle: Battle): void {
  const sides = ["center", "right", "center", "right"] as const;
  for (const [index, side] of sides.entries()) {
    if (index > 0) battle.grantTurn(1, AUTH_NOW + index);
    const melee = battle.tryPlayerMelee(1, side, AUTH_NOW + index);
    expect(melee.kind).toBe("resolved");
  }
}

describe("glove AOE leftover", () => {
  it("halves kind-1 roll per extra GLOVE_MAGIC target", () => {
    expect(aoeKind1Damage(8)).toBe(4);
    expect(aoeKind1Damage(1)).toBe(1);
    expect(
      gloveKind1IsAoe({
        effects: [{ kind: 1, targetCount: 2 }],
      }),
    ).toBe(true);
    expect(
      gloveKind1IsAoe({
        effects: [{ kind: 1, dmgType: 128 }],
      }),
    ).toBe(false);
  });

  it("hits the ally's bot and notifies that hunter", () => {
    const battle = pairedHunt();
    buildFourCombo(battle);
    battle.grantTurn(1, AUTH_NOW + 10);
    const ending = battle.tryGlove(1, 9099, 5, AUTH_NOW + 10);
    expect(ending.kind).toBe("ending");
    if (ending.kind !== "ending") throw new Error("expected ending glove");
    expect(ending.hitTargetIds).toEqual([1_000_000, 1_000_001]);
    expect(ending.events.find((event) => event.type === "damage")).toMatchObject({
      type: "damage",
      targetId: 1_000_000,
      animation: "magic_aoe_light",
      hpChange: -4,
    });
    const patch = ending.events.find((event) => event.type === "pers-change");
    expect(patch).toMatchObject({ type: "pers-change" });
    if (!patch || patch.type !== "pers-change") throw new Error("expected pers-change");
    expect(ending.events.map((event) => event.type).indexOf("damage")).toBeLessThan(
      ending.events.map((event) => event.type).indexOf("pers-change"),
    );
    expect(patch.bots.map((bot) => bot.id).sort((a, b) => a - b)).toEqual([1_000_000, 1_000_001]);
    expect(patch.bots.find((bot) => bot.id === 1_000_001)?.hp).toBe(196);
    expect(ending.sideNotifies).toHaveLength(1);
    expect(ending.sideNotifies[0]).toMatchObject({ accountId: 2 });
    expect(ending.sideNotifies[0]?.events.map((event) => event.type)[0]).toBe("damage");
    expect(ending.sideNotifies[0]?.events.find((event) => event.type === "damage")).toMatchObject({
      type: "damage",
      sourceId: 1,
      targetId: 1_000_001,
      animation: "magic_aoe_light",
      hpChange: -4,
    });
    expect(battle.foeBotSnap(1).hp).toBe(164);
    expect(battle.foeBotSnap(2).hp).toBe(196);
  });

  it("writes AOE HP onto a waiting clone with no paired hunter", () => {
    const battle = new Battle(huntInit({ heroAggroCharges: 1 }), UNIT_BATTLE_RULES, {
      integer(minInclusive) {
        return minInclusive;
      },
      unit() {
        return 0.4;
      },
    });
    battle.authenticate(1, AUTH_NOW);
    expect(battle.tryAggro(1, () => 1_000_001).kind).toBe("resolved");
    buildFourCombo(battle);
    battle.grantTurn(1, AUTH_NOW + 10);
    const ending = battle.tryGlove(1, 9099, 5, AUTH_NOW + 10);
    expect(ending.kind).toBe("ending");
    if (ending.kind !== "ending") throw new Error("expected ending glove");
    expect(ending.hitTargetIds).toEqual([1_000_000, 1_000_001]);
    const waiting = battle.boardParticipants().bots.find((bot) => bot.id === 1_000_001);
    if (!waiting) throw new Error("waiting clone is missing from the roster");
    expect(waiting.hp).toBeLessThan(waiting.maxHp);
  });

  it("keeps 9098 on the current pair", () => {
    const battle = pairedHunt();
    battle.tryPlayerMelee(1, "center", AUTH_NOW);
    battle.grantTurn(1, AUTH_NOW + 1);
    battle.tryPlayerMelee(1, "right", AUTH_NOW + 1);
    battle.grantTurn(1, AUTH_NOW + 2);
    const ending = battle.tryGlove(1, 9098, 5, AUTH_NOW + 2);
    expect(ending.kind).toBe("ending");
    if (ending.kind !== "ending") throw new Error("expected ending glove");
    expect(ending.hitTargetIds).toEqual([1_000_000]);
    expect(ending.sideNotifies).toEqual([]);
    expect(ending.events.some((event) => event.type === "pers-change")).toBe(false);
    expect(battle.foeBotSnap(2).hp).toBe(200);
  });

  it("puts the ally cast on the joiner poll", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([0.4, 8, 2, 8, 2, 8, 2, 8, 2, 8, 8]),
    });
    await startHuntWithIssuedId(
      combat,
      unitHuntStart({ loadout: aoeLoadout, botHp: 200, heroAggroCharges: 1 }),
    );
    await combat.joinHunt(unitHuntJoin({ fightId: "1", loadout: aoeLoadout }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "aggro", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    await strikeAndLoop(combat, delay, clock, "center", 3);
    await strikeAndLoop(combat, delay, clock, "right", 4);
    await strikeAndLoop(combat, delay, clock, "center", 5);
    await strikeAndLoop(combat, delay, clock, "right", 6);
    await combat.execute(1, { kind: "glove", spellId: 9099, sequence: 7 });
    const caster = await combat.execute(1, { kind: "poll" });
    expect(caster.map((event) => event.type)).toEqual(
      expect.arrayContaining(["command-accepted", "turn-wait", "damage", "pers-change"]),
    );
    const ally = await combat.execute(2, { kind: "poll" });
    expect(ally.map((event) => event.type).indexOf("damage")).toBeLessThan(
      ally.map((event) => event.type).indexOf("pers-change"),
    );
    expect(ally.find((event) => event.type === "damage")).toMatchObject({
      type: "damage",
      sourceId: 1,
      animation: "magic_aoe_light",
    });
    expect(ally.find((event) => event.type === "damage")?.targetId).not.toBe(1_000_000);
  });
});

async function strikeAndLoop(
  combat: ReturnType<typeof createCombatService>["combat"],
  delay: ReturnType<typeof createCombatService>["delay"],
  clock: MutableClock,
  side: "left" | "center" | "right",
  sequence: number,
): Promise<void> {
  await combat.execute(1, { kind: "strike", side, sequence });
  await combat.execute(1, { kind: "poll" });
  await combat.execute(2, { kind: "poll" });
  clock.advanceMs(1400);
  await delay.fireDue(clock.now());
  await combat.execute(1, { kind: "poll" });
  await combat.execute(2, { kind: "poll" });
  clock.advanceMs(1100);
  await delay.fireDue(clock.now());
  await combat.execute(1, { kind: "poll" });
  await combat.execute(2, { kind: "poll" });
}
