import { resolveBotMelee } from "../../support/ai-turn.ts";
import { rosterOf } from "../../support/roster-of.ts";
import { describe, expect, it } from "vitest";
import { requireFightBot } from "../../../src/modules/combat/domain/fight-bots.ts";
import type { BotFighterSeed } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { pairLeftoverRosterBots } from "../../../src/modules/combat/domain/pair-leftover-roster-bots.ts";
import { resolveAiActorTurn } from "../../../src/modules/combat/domain/resolve-ai-actor-turn.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitFightBots } from "../../support/fight-bots.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitHuntFightSetup } from "../../support/fight-setup.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");
const TEAM = { openerTeam: 1 as const, enemyTeam: 2 as const };

function botSeed(fightId: number): BotFighterSeed {
  return {
    fightId,
    artikulId: 2,
    nick: `bot${fightId}`,
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

function leftoverBots() {
  return unitFightBots({
    extraEnemies: [botSeed(1_000_001)],
    allies: [botSeed(1_000_002)],
    teamAssignment: TEAM,
  });
}

describe("resolveAiActorTurn", () => {
  it("resolves a bot vs human turn through the same scheduler as bot vs bot", () => {
    const battle = createUnitBattle(unitHuntFightSetup(), new SequenceRandom([2, 2]));
    battle.authenticate(1, AUTH_NOW);
    const vsHuman = resolveBotMelee(battle, 1, AUTH_NOW);
    expect(vsHuman.events.some((event) => event.type === "damage")).toBe(true);
    expect(vsHuman.killedPlayer).toBe(false);

    const bots = leftoverBots();
    const leftover = pairLeftoverRosterBots(bots, TEAM);
    const extra = leftover[0];
    if (!extra) throw new Error("expected leftover bot↔bot duel");
    const actor = requireFightBot(bots, extra.nextActorId);
    const vsBot = resolveAiActorTurn({
      bot: actor,
      duel: extra,
      roster: rosterOf([], bots),
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([2]),
      fightId: "1",
      nowMs: AUTH_NOW,
    });
    expect(vsBot.killedPlayer).toBe(false);
    expect(vsBot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "damage", sourceId: actor.fightId }),
      ]),
    );
  });

  it("throws when the AI actor in a bot↔bot duel is already dead", () => {
    const bots = leftoverBots();
    const leftover = pairLeftoverRosterBots(bots, TEAM);
    const extra = leftover[0];
    if (!extra) throw new Error("expected leftover bot↔bot duel");
    const actor = requireFightBot(bots, extra.nextActorId);
    actor.setHp(0);
    expect(() =>
      resolveAiActorTurn({
        bot: actor,
        duel: extra,
        roster: rosterOf([], bots),
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([2]),
        fightId: "1",
        nowMs: AUTH_NOW,
      }),
    ).toThrow(/AI actor \d+ is dead/);
  });
});
