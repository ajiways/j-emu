import { describe, expect, it } from "vitest";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { requireFightBot } from "../../../src/modules/combat/domain/fight-bots.ts";
import type { HuntRosterBotSeed } from "../../../src/modules/combat/domain/hunt-roster-bot.ts";
import { pairLeftoverRosterBots } from "../../../src/modules/combat/domain/pair-leftover-roster-bots.ts";
import { resolveAiActorTurn } from "../../../src/modules/combat/domain/resolve-ai-actor-turn.ts";
import { tickHuntRosterDuels } from "../../../src/modules/combat/domain/battle-hunt-runtime.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitFightBots } from "../../support/fight-bots.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitHuntFightSetup } from "../../support/fight-setup.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");
const TEAM = { openerTeam: 1 as const, enemyTeam: 2 as const };

function botSeed(fightId: number): HuntRosterBotSeed {
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

function openerHuman(): HuntHuman {
  return new HuntHuman({
    accountId: 1,
    heroId: 1,
    nick: "Hero",
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

describe("resolveAiActorTurn", () => {
  it("resolves a bot vs human turn through the same scheduler as bot vs bot", () => {
    const battle = createUnitBattle(unitHuntFightSetup(), new SequenceRandom([2, 2]));
    battle.authenticate(1, AUTH_NOW);
    const vsHuman = battle.resolveBotMelee(1);
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
      humans: [],
      bots,
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([2]),
      fightId: "1",
      keepFightOnKill: true,
      living: [],
      winnerTeam: 1,
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
        humans: [],
        bots,
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([2]),
        fightId: "1",
        keepFightOnKill: true,
        living: [],
        winnerTeam: 1,
      }),
    ).toThrow(/Roster bot actor is dead/);
  });

  it("dissolves a dead extra duel on tick instead of resolving a dead actor", () => {
    const bots = leftoverBots();
    const leftover = pairLeftoverRosterBots(bots, TEAM);
    const extra = leftover[0];
    if (!extra) throw new Error("expected leftover bot↔bot duel");
    requireFightBot(bots, extra.nextActorId).setHp(0);
    const duels = [new FightDuel(1, 1_000_000, 1), extra];
    const opener = openerHuman();
    const ticked = tickHuntRosterDuels({
      hasEnemyBots: true,
      bots,
      enemyTeam: 2,
      duels,
      finished: false,
      opener,
      humans: [opener],
      fightId: "1",
      rules: UNIT_BATTLE_RULES,
      random: new SequenceRandom([2]),
    });
    expect(ticked.events.filter((event) => event.type === "damage")).toEqual([]);
    expect(duels).toHaveLength(1);
    expect(duels[0]?.has(1)).toBe(true);
    expect(requireFightBot(bots, 1_000_001).waiting).toBe(true);
  });
});
