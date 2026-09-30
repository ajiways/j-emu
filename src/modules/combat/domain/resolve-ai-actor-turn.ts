import type { Roster } from "./roster.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { advanceDuelClock, botActionJumpSeconds } from "./duel-clock.ts";
import type { FightDuel } from "./fight-duel.ts";
import { resolveAiTurn } from "./ai-turn.ts";
import { duelFoe, enemySideCleared } from "./melee-target.ts";
import { opposingTeam } from "./opposing-team.ts";
import type { BotMeleeResult } from "./turn-grant.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";

/**
 * One AI turn in a duel, whoever the foe is: the brain acts, the duel's hit counter and clock
 * move, and a side that has no one left standing ends the fight.
 */
export function resolveAiActorTurn(
  input: Readonly<{
    bot: BotFighter;
    duel: FightDuel;
    roster: Roster;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    nowMs: number;
  }>,
): BotMeleeResult {
  const everyone = input.roster.all();
  const foe = duelFoe(input.duel, everyone, input.bot.id);
  if (!input.bot.alive) throw new Error(`AI actor ${input.bot.id} is dead`);
  if (!foe.alive) throw new Error(`AI actor ${input.bot.id} has a dead foe`);
  const skipsTurn = input.bot.stunnedTurns > 0;
  const turn = resolveAiTurn(input.bot, foe, {
    rules: input.rules,
    random: input.random,
    nowMs: input.nowMs,
    enemies: everyone.filter((entry) => entry.team !== input.bot.team && entry.alive),
  });
  if (!skipsTurn) input.duel.addHit(input.bot.id);
  const events = [...turn.events];
  if (input.bot.alive && foe.alive) {
    events.push(...botClockTicks(input, foe));
    input.duel.setNextActor(foe.id);
  }
  const lost = [foe, input.bot].find(
    (entry) => !entry.alive && enemySideCleared(entry.team, everyone),
  );
  if (lost) {
    events.push({ type: "finished", winnerTeam: opposingTeam(lost.team), fightId: input.fightId });
  }
  return {
    events,
    killedPlayer: foe.fighterKind === "human" && !foe.alive,
    sideHits: turn.sideHits,
  };
}

function botClockTicks(
  input: Readonly<{
    bot: BotFighter;
    roster: Roster;
    rules: BattleRules;
    random: RandomSource;
    nowMs: number;
  }>,
  other: Participant,
): readonly BattleEvent[] {
  return advanceDuelClock({
    fighters: [input.bot, other],
    nowMs: input.nowMs,
    jumpSeconds: botActionJumpSeconds(input.rules),
    random: input.random,
    rules: input.rules,
    sources: input.roster.all(),
  });
}
