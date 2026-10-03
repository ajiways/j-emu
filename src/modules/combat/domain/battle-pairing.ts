import type { BattleEvent } from "./battle-event.ts";
import type { HumanFighter } from "./human-fighter.ts";

export function livingWaiterOnTeam(
  humans: readonly HumanFighter[],
  team: 1 | 2,
): HumanFighter | undefined {
  return humans.find((entry) => entry.waiting && entry.alive && entry.team === team);
}

export function humanOpponentNew(human: HumanFighter): BattleEvent {
  return {
    type: "opponent-new-human",
    human: human.snapshot(),
    appearance: human.appearance,
  };
}
