import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { battleOpener } from "./battle-lookups.ts";
import { tickHuntRosterDuels } from "./battle-hunt-runtime.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { RandomSource } from "./random-source.ts";
import { hasPairableSeekers, pairHuntQueues } from "./try-pair-hunt-queues.ts";

type BotDuelState = Readonly<{
  fightRules: FightRules;
  finished: boolean;
  humans: readonly HumanFighter[];
  duels: readonly FightDuel[];
  bots: readonly BotFighter[];
  rules: BattleRules;
  random: RandomSource;
  fightId: string;
}>;

/**
 * Whether the fight has work that no click triggers: a duel of two mobs, or waiting participants
 * of both teams who could be paired.
 */
export function hasBotDuels(state: BotDuelState): boolean {
  if (state.finished) return false;
  const isBot = (id: number) => state.bots.some((bot) => bot.fightId === id);
  return (
    state.duels.some((duel) => isBot(duel.aId) && isBot(duel.bId)) ||
    hasPairableSeekers(state.humans, state.bots, state.duels)
  );
}

/** Pairs the waiting participants of both teams; returns the accounts of the players paired. */
export function pairWaitingSeekers(
  state: BotDuelState & Readonly<{ duels: FightDuel[] }>,
): readonly number[] {
  const waitingBefore = new Set(
    state.humans.filter((human) => human.waiting).map((human) => human.accountId),
  );
  pairHuntQueues({
    humans: state.humans,
    duels: state.duels,
    bots: state.bots,
    random: state.random,
  });
  return state.humans
    .filter((human) => waitingBefore.has(human.accountId) && !human.waiting)
    .map((human) => human.accountId);
}

/** One action of every mob duel, in the order the duels were made. */
export function tickBotDuels(
  state: BotDuelState & Readonly<{ duels: FightDuel[] }>,
  nowMs: number,
): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  return tickHuntRosterDuels({
    bots: state.bots,
    enemyTeam: state.fightRules.teamAssignment.enemyTeam,
    duels: state.duels,
    finished: state.finished,
    opener: battleOpener(state.humans),
    humans: state.humans,
    fightId: state.fightId,
    rules: state.rules,
    random: state.random,
    nowMs,
  });
}
