import type { Roster } from "./roster.ts";
import type { FightDuel } from "./fight-duel.ts";
import { fightDuelDelayToken } from "./fight-delay-token.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { hasPairableSeekers, pairQueues } from "./pairing.ts";

type AiDuelState = Readonly<{
  fightId: string;
  finished: boolean;
  roster: Roster;
  duels: readonly FightDuel[];
  random: RandomSource;
}>;

/** An AI participant whose turn it is and whom no click will move: it has to be started. */
export type AiDuelTurn = Readonly<{ botId: number; token: string }>;

/**
 * Whose turn it is in every duel that waits for an AI participant to act: a duel of two of them
 * (nobody's click moves those) and one where a mob opens against a player who is already in the
 * fight (the player moves after it).
 */
export function aiOnlyDuelTurns(state: AiDuelState): readonly AiDuelTurn[] {
  if (state.finished) return [];
  const live = (id: number) => state.roster.bots.some((bot) => bot.fightId === id && bot.alive);
  const present = (id: number) =>
    live(id) ||
    state.roster.humans.some((human) => human.heroId === id && human.authed && human.alive);
  return state.duels
    .filter((duel) => present(duel.aId) && present(duel.bId) && live(duel.nextActorId))
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
    state.roster.humans.filter((human) => human.waiting).map((human) => human.accountId),
  );
  pairQueues({ participants: everyone(state), duels: state.duels, random: state.random });
  return state.roster.humans
    .filter((human) => waitingBefore.has(human.accountId) && !human.waiting)
    .map((human) => human.accountId);
}

function everyone(state: AiDuelState): readonly Participant[] {
  return state.roster.all();
}
