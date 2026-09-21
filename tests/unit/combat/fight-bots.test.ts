import { describe, expect, it } from "vitest";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HuntRosterBot } from "../../../src/modules/combat/domain/hunt-roster-bot.ts";
import {
  enqueueAggroClone,
  primaryEnemyBot,
  requireFightBot,
  requireFightBots,
  seedFightBots,
} from "../../../src/modules/combat/domain/fight-bots.ts";
import { seedBattleParticipants } from "../../../src/modules/combat/domain/battle-seed.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import {
  enemySideCleared,
  fightCombatants,
} from "../../../src/modules/combat/domain/melee-target.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { unitFightBots, unitBotSeed } from "../../support/fight-bots.ts";
import { unitDuelFightSetup, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

describe("fight bots on Battle", () => {
  it("seeds a human duel with an empty bot list, not null", () => {
    const seed = seedBattleParticipants(
      unitDuelFightSetup(),
      UNIT_BATTLE_RULES,
      FightRules.forFriendlyDuel(),
    );
    expect(seed.bots).toEqual([]);
    expect("huntRoster" in seed).toBe(false);
    const battle = createUnitBattle(unitDuelFightSetup(), new SequenceRandom([1]));
    expect(battle.bots).toEqual([]);
    expect(battle.authenticate(1, AUTH_NOW)[0]).toMatchObject({ type: "friendly-bootstrap" });
  });

  it("seeds hunt bots onto the same Battle as humans", () => {
    const setup = unitHuntFightSetup();
    const seed = seedBattleParticipants(setup, UNIT_BATTLE_RULES, FightRules.forHunt(null));
    expect(seed.bots.map((bot) => bot.fightId)).toEqual([1_000_000]);
    const battle = createUnitBattle(setup, new SequenceRandom([8]));
    expect(battle.bots.map((bot) => bot.fightId)).toEqual([1_000_000]);
    expect(primaryEnemyBot(battle.bots, 2).fightId).toBe(1_000_000);
  });

  it("throws when a fight bot id is missing", () => {
    expect(() => requireFightBot([], 1_000_000)).toThrow(/Fight bot 1000000 is missing/);
    expect(() => requireFightBots(null)).toThrow(/Battle fight bots are required/);
    expect(() => requireFightBots(undefined)).toThrow(/Battle fight bots are required/);
  });

  it("finds the primary enemy by enemy team, not by array index 0", () => {
    const ally = HuntRosterBot.fromSeed(
      {
        fightId: 1_000_002,
        artikulId: 4,
        nick: "Hissa",
        level: 1,
        hp: 20,
        strength: 10,
        initiative: 0,
        magPower: 0,
        magResist: 0,
        avatar: GRYZL_FIGHT_LOOK.botAvatar,
        sk: GRYZL_FIGHT_LOOK.botSk,
        body: GRYZL_FIGHT_LOOK.botBody,
        spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      },
      1,
      new FightEffectIds(),
    );
    const enemy = HuntRosterBot.fromSeed(unitBotSeed(1_000_000, "Грызль"), 2, new FightEffectIds());
    expect(primaryEnemyBot([ally, enemy], 2)).toBe(enemy);
    expect(() => primaryEnemyBot([ally], 2)).toThrow(/missing the primary enemy bot/);
  });

  it("enqueues an aggro clone as waiting on the live bot list", () => {
    const bots = unitFightBots();
    const clone = enqueueAggroClone(bots, 1_000_000, 1_000_001, 2);
    expect(bots.map((bot) => bot.fightId)).toEqual([1_000_000, 1_000_001]);
    expect(clone.waiting).toBe(true);
    expect(clone.fightId).toBe(1_000_001);
    expect(() => enqueueAggroClone(bots, 1_000_000, 1_000_001, 2)).toThrow(
      /Fight bot id 1000001 collides/,
    );
  });

  it("clears the enemy side from combatants without a HuntRoster", () => {
    const bots = seedFightBots({
      enemyAis: [unitBotSeed(1_000_000)],
      openerAis: [],
      occupiedIds: [1],
      effectIds: new FightEffectIds(),
      enemyTeam: 2,
      openerTeam: 1,
    });
    const primary = bots[0];
    if (!primary) throw new Error("expected a seeded enemy bot");
    expect(enemySideCleared(2, fightCombatants([], bots))).toBe(false);
    primary.applyDamage(20);
    expect(enemySideCleared(2, fightCombatants([], bots))).toBe(true);
  });
});
