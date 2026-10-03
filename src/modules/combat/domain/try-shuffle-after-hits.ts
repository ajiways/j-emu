import type { BattleEvent } from "./battle-event.ts";

export const PAIR_HITS_TO_SWITCH = 3;

export type ShufflePlan = "none" | "waiter-handoff" | "cross-swap" | "reserve-swap";

/** What one player's client is told when his duel changes hands. */
export type ShuffleTell = Readonly<{ accountId: number; events: readonly BattleEvent[] }>;

/**
 * A duel that changed its sides: who is told what, which players open the new duel with a turn,
 * and whose pending turn timers it replaces. Players and mobs alike take part.
 */
export type ShuffleOutcome =
  | Readonly<{ kind: "none" }>
  | Readonly<{
      kind: Exclude<ShufflePlan, "none">;
      tells: readonly ShuffleTell[];
      starts: readonly number[];
      affected: readonly number[];
    }>;

export function planShuffle(
  input: Readonly<{
    humanHits: number;
    botHits: number;
    hasLivingWaiter: boolean;
    hasSwappableOther: boolean;
    hasLivingReserve: boolean;
    finished: boolean;
  }>,
): ShufflePlan {
  if (input.finished) return "none";
  if (!Number.isInteger(input.humanHits) || input.humanHits < 0) {
    throw new Error("Duel human hits must be a non-negative integer");
  }
  if (!Number.isInteger(input.botHits) || input.botHits < 0) {
    throw new Error("Duel bot hits must be a non-negative integer");
  }
  if (input.humanHits < PAIR_HITS_TO_SWITCH || input.botHits < PAIR_HITS_TO_SWITCH) {
    return "none";
  }
  if (input.hasLivingWaiter) return "waiter-handoff";
  if (input.hasSwappableOther) return "cross-swap";
  if (input.hasLivingReserve) return "reserve-swap";
  return "none";
}
