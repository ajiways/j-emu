import type { BattleEvent } from "./battle-event.ts";

export const PAIR_HITS_TO_SWITCH = 3;

export type ShufflePlan = "none" | "reset" | "waiter-handoff";

export type ShuffleOutcome =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "reset" }>
  | Readonly<{
      kind: "waiter-handoff";
      actorAccountId: number;
      waiterAccountId: number;
      waiterAuthed: boolean;
      events: readonly BattleEvent[];
    }>;

export function planHuntShuffle(
  input: Readonly<{
    humanHits: number;
    botHits: number;
    hasLivingWaiter: boolean;
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
  return input.hasLivingWaiter ? "waiter-handoff" : "reset";
}
