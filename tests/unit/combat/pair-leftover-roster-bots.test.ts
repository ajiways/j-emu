import { describe, expect, it } from "vitest";
import { seedBattleParticipants } from "../../../src/modules/combat/domain/battle-seed.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import type { HuntRosterBotSeed } from "../../../src/modules/combat/domain/hunt-roster-bot.ts";
import { pairLeftoverRosterBots } from "../../../src/modules/combat/domain/pair-leftover-roster-bots.ts";
import { requireFightBot } from "../../../src/modules/combat/domain/fight-bots.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { unitFightBots } from "../../support/fight-bots.ts";
import { unitHuntFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";

function botSeed(fightId: number, nick: string): HuntRosterBotSeed {
  return {
    fightId,
    artikulId: 32,
    nick,
    level: 1,
    hp: 20,
    strength: 20,
    initiative: 0,
    magPower: 0,
    magResist: 0,
    avatar: GRYZL_FIGHT_LOOK.botAvatar,
    sk: GRYZL_FIGHT_LOOK.botSk,
    body: GRYZL_FIGHT_LOOK.botBody,
    spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
  };
}

describe("pairLeftoverRosterBots", () => {
  it("opens leftover ally↔enemy with the ally and does not roll initiative", () => {
    const teamAssignment = { openerTeam: 2 as const, enemyTeam: 1 as const };
    const bots = unitFightBots({
      extraEnemies: [botSeed(1_000_001, "Spirit")],
      allies: [botSeed(1_000_002, "Hissa")],
      teamAssignment,
    });
    const duels = pairLeftoverRosterBots(bots, teamAssignment);
    expect(duels).toHaveLength(1);
    expect(duels[0]?.aId).toBe(1_000_002);
    expect(duels[0]?.bId).toBe(1_000_001);
    expect(duels[0]?.nextActorId).toBe(1_000_002);
    expect(requireFightBot(bots, 1_000_001).waiting).toBe(false);
    expect(requireFightBot(bots, 1_000_002).waiting).toBe(false);
  });
});

describe("quest leftover duels in Battle.duels", () => {
  it("seeds leftover bot↔bot next to the opener duel without consuming RNG", () => {
    const extra = botSeed(1_000_001, "Spirit");
    const ally = botSeed(1_000_002, "Hissa");
    const setup = unitHuntFightSetup({
      purpose: "quest",
      extraEnemies: [extra],
      allies: [ally],
    });
    const seed = seedBattleParticipants(
      setup,
      UNIT_BATTLE_RULES,
      FightRules.for({ kind: "quest", botCount: 3 }),
    );
    expect(seed.duels).toHaveLength(2);
    expect(seed.duels[0]?.has(1)).toBe(true);
    expect(seed.duels[0]?.has(1_000_000)).toBe(true);
    expect(seed.duels[0]?.nextActorId).toBe(1);
    expect(seed.duels[1]?.has(1_000_001)).toBe(true);
    expect(seed.duels[1]?.has(1_000_002)).toBe(true);
    expect(seed.duels[1]?.nextActorId).toBe(1_000_002);
    const battle = createUnitBattle(setup, new SequenceRandom([2]));
    const events = battle.tickRosterDuels();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "damage",
          sourceId: 1_000_002,
          targetId: 1_000_001,
        }),
      ]),
    );
  });
});
