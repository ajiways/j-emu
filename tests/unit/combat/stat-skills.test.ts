import { describe, expect, it } from "vitest";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { castTimedSpell } from "../../../src/modules/combat/domain/timed-spell.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

function hero(): HumanFighter {
  return new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 1,
    kind: 1,
    hp: 100,
    maxHp: 100,
    mp: 10,
    maxMp: 10,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(20),
    initiative: 40,
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

function bot(): BotFighter {
  return BotFighter.fromSeed(
    {
      fightId: 1_000_000,
      artikulId: 6,
      nick: "Разбойник",
      level: 1,
      hp: 100,
      strength: 10,
      initiative: 30,
      magPower: 0,
      magResist: 0,
      avatar: "a.jpg",
      sk: "1",
      body: "",
      spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    },
    2,
    new FightEffectIds(),
  );
}

function buff(human: HumanFighter | BotFighter, skills: [string, number][]): void {
  const spell: CombatSpell = {
    animData: "baf",
    effects: [
      { kind: 3, duration: 40, skills: skills.map(([skillId, value]) => ({ skillId, value })) },
    ],
  };
  castTimedSpell(human, human, { artikulId: 1, title: "t", picture: "p.png", spell, flags: 0 }, 0);
}

describe("LUCK", () => {
  it("adds to the initiative of a hero and of a bot, never below zero", () => {
    const human = hero();
    const foe = bot();
    buff(human, [["LUCK", 25]]);
    buff(foe, [["LUCK", -50]]);
    expect(human.currentInitiative).toBe(65);
    expect(foe.currentInitiative).toBe(0);
  });
});

describe("RAGE_MOD", () => {
  it("raises the rage a received hit adds while it stands", () => {
    const human = hero();
    const plain = human.awardIncomingRage(35);
    human.casts.spendRage();
    buff(human, [["RAGE_MOD", 80]]);
    expect(human.awardIncomingRage(35)).toBeCloseTo(plain * 1.8, 5);
  });

  it("adds pcRAGE_MOD to RAGE_MOD", () => {
    const human = hero();
    const plain = human.awardIncomingRage(35);
    human.casts.spendRage();
    buff(human, [
      ["RAGE_MOD", 50],
      ["pcRAGE_MOD", 30],
    ]);
    expect(human.awardIncomingRage(35)).toBeCloseTo(plain * 1.8, 5);
  });
});
