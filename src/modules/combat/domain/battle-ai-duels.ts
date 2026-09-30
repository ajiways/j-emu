import type { BotFighter } from "./bot-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import { fightDuelDelayToken } from "./fight-delay-token.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { hasPairableSeekers, pairQueues } from "./pairing.ts";

type AiDuelState = Readonly<{
  fightId: string;
  finished: boolean;
  humans: readonly HumanFighter[];
  duels: readonly FightDuel[];
  bots: readonly BotFighter[];
  random: RandomSource;
}>;

/** An AI participant whose turn it is in a duel where no player stands on either side. */
export type AiDuelTurn = Readonly<{ botId: number; token: string }>;

/** Whose turn it is in every duel of two AI participants: nobody's click moves those. */
export function aiOnlyDuelTurns(state: AiDuelState): readonly AiDuelTurn[] {
  if (state.finished) return [];
  const live = (id: number) => state.bots.some((bot) => bot.fightId === id && bot.alive);
  return state.duels
    .filter((duel) => live(duel.aId) && live(duel.bId) && live(duel.nextActorId))
    .map((duel) => ({
      botId: duel.nextActorId,
      token: fightDuelDelayToken(state.fightId, duel),
    }));
}

/** Whether waiting participants of both teams could be paired right now. */
export function hasPairableWaiters(state: AiDuelState): boolean {
  return !state.finished && hasPairableSeekers(everyone(state), state.duels);
}

/** Pairs the waiting participants of both teams; returns the accounts of the players paired. */
export function pairWaitingSeekers(
  state: AiDuelState & Readonly<{ duels: FightDuel[] }>,
): readonly number[] {
  const waitingBefore = new Set(
    state.humans.filter((human) => human.waiting).map((human) => human.accountId),
  );
  pairQueues({ participants: everyone(state), duels: state.duels, random: state.random });
  return state.humans
    .filter((human) => waitingBefore.has(human.accountId) && !human.waiting)
    .map((human) => human.accountId);
}

function everyone(state: AiDuelState): readonly Participant[] {
  return [...state.humans, ...state.bots];
}
